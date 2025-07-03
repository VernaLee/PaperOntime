import { Permissions, webMethod } from "wix-web-module";
import wixData                   from "wix-data";
import { fetch }                 from "wix-fetch";
import { getExchangeRates } from "backend/exchangeRate.web";

const STRIPE_SECRET_KEY = " ";

// Maps for translating string inputs to numeric multipliers
const serviceMultipliers = {
  "Drafting": 1,
  "Editing": 0.7,
  "Proofreading": 0.3
};
const academicLevelMultipliers = {
  "Undergraduate": 1.3,
  "Postgraduate": 1.5,
  "PhD": 1.8
};
const deadlineMultipliers = {
  "24 hrs": 2,
  "2 days": 1.8,
  "3 days": 1.6,
  "5 days": 1.4,
  "7 days": 1.2,
  "10 days": 1,
  "30 days": 1
};
// paper type difficulty multipliers
const paperTypeMultipliers = {
  "Annotated Bibliography":           1.1,
  "Case Study":                       1.3,
  "Critical Review":                  1.2,
  "Dissertation":                     1.5,
  "Dissertation Chapter (give chapter later)": 1.5,
  "Essay (give type later)":          1.0,
  "Literature Review":                1.5,
  "Policy Brief":                     1.2,
  "Position Paper":                   1.3,
  "Reflection Paper":                 0.9,
  "Report":                           1.3,
  "Research Paper":                   1.5,
  "Research Proposal":                1.0
};

/**
 * Calculates the price and returns a number rounded to two decimal places.
 */
function calculatePrice({ service, academicLevel, deadline, wordCount, appliedDiscountFraction, paperType }) {
  // Validate mappings exist
  if (!serviceMultipliers.hasOwnProperty(service)) {
    throw new Error(`Unknown service type: ${service}`);
  }
  if (!academicLevelMultipliers.hasOwnProperty(academicLevel)) {
    throw new Error(`Unknown academic level: ${academicLevel}`);
  }
  if (!deadlineMultipliers.hasOwnProperty(deadline)) {
    throw new Error(`Unknown deadline value: ${deadline}`);
  }
  if (!paperTypeMultipliers.hasOwnProperty(paperType)) {
    throw new Error(`Unknown paper type: ${paperType}`);
  }

  const serviceMul   = serviceMultipliers[service];
  const levelMul     = academicLevelMultipliers[academicLevel];
  const urgencyMul   = deadlineMultipliers[deadline];
  const paperMul     = paperTypeMultipliers[paperType];

  // Parse and validate word count
  const wc = parseInt(wordCount, 10);
  if (isNaN(wc) || wc <= 0) {
    throw new Error(`Invalid wordCount: ${wordCount}`);
  }

  // Parse and validate discount fraction
  const discount = parseFloat(appliedDiscountFraction);
  if (isNaN(discount) || discount < 0 || discount >= 1) {
    throw new Error(`Invalid discount fraction: ${appliedDiscountFraction}`);
  }

  const baseRate = 0.07; // GBP per word
  const raw = wc * baseRate * serviceMul * levelMul * urgencyMul * paperMul;
  const finalAmt = raw * (1 - discount);

  // Round to two decimal places
  return Math.round(finalAmt * 100) / 100;
}

export const createPayment = webMethod(Permissions.Anyone, async (data) => {
  const {
    orderRecordId,
    orderNumber,
    service,
    academicLevel,
    deadline,
    wordCount,
    appliedDiscountFraction,
    paperType,
    currency
  } = data;

  // ─── 1) Basic validation ─────────────────────────────────────────
  const missing = [];
  if (!orderRecordId) missing.push("orderRecordId");
  if (!service)         missing.push("service");
  if (!academicLevel)   missing.push("academicLevel");
  if (!deadline)        missing.push("deadline");
  if (!wordCount)       missing.push("wordCount");
  if (!paperType)       missing.push("paperType");
  if (!currency)        missing.push("currency");

  if (missing.length) {
    throw new Error(`Validation error - missing: [${missing.join(", ")}]`);
  }

  // ─── 2) Load current FX rates ────────────────────────────────────
  const rates = await getExchangeRates();
  if (!rates[currency]) {
    throw new Error(`Unsupported currency code: ${currency}`);
  }

  // ─── 3) Compute raw price in GBP ─────────────────────────────────
  let rawPriceGBP;
  try {
    rawPriceGBP = calculatePrice({
      service,
      academicLevel,
      deadline,
      wordCount,
      appliedDiscountFraction,
      paperType
    });
  } catch (err) {
    console.error("Price calculation error:", err);
    throw new Error("Unable to calculate price");
  }

  // ─── 4) Convert into requested currency ──────────────────────────
  const convertedPrice = Math.round(rawPriceGBP * rates[currency] * 100) / 100;

  // ─── 5) Fetch & update your Orders record ───────────────────────
  let existing;
  try {
    existing = await wixData.get("Orders", orderRecordId, { suppressAuth: true });
  } catch (err) {
    console.error("Order fetch failed:", err);
    throw new Error(`Order lookup failed for ID ${orderRecordId}`);
  }
  if (!existing) {
    throw new Error(`Order not found: ${orderRecordId}`);
  }

  existing.paymentAmount = convertedPrice;
  existing.currency      = currency;
  try {
    await wixData.update("Orders", existing, { suppressAuth: true });
  } catch (err) {
    console.error("Order update failed:", err);
    throw new Error("Could not update order record");
  }

  // ─── 6) Build and call Stripe ────────────────────────────────────
  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("success_url",
    `https://paperontime.online/payment-success?session_id={CHECKOUT_SESSION_ID}&orderNumber=${orderNumber}`);
  params.append("cancel_url", "https://paperontime.online/order");
  params.append("line_items[0][price_data][currency]", currency.toLowerCase());
  // stripe wants cents/pence
  params.append("line_items[0][price_data][unit_amount]",
    Math.round(convertedPrice * 100).toString());
  params.append("line_items[0][price_data][product_data][name]", "Custom Drafting Service");
  params.append("line_items[0][quantity]", "1");

  let stripeSession;
  try {
    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method:  "post",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type":  "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    stripeSession = await resp.json();
  } catch (err) {
    console.error("Stripe API request failed:", err);
    throw new Error("Payment gateway error");
  }
  if (stripeSession.error) {
    console.error("Stripe error:", stripeSession.error);
    throw new Error(stripeSession.error.message || "Unknown Stripe error");
  }

  return { sessionUrl: stripeSession.url };
});
