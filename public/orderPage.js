import wixData from 'wix-data';
import { session } from "wix-storage";
import wixLocation from 'wix-location';
import { createOrder } from "backend/orderService.web";
import { getExchangeRates } from "backend/exchangeRate.web";
import { createPayment } from "backend/pay.web";
import { customAlphabet } from "nanoid";
import wixWindow from 'wix-window';

let web_price_Arr = [0.8, 1];
let wordCount_Arr = [250];
let basePrice = 0;
let price;
let appliedDiscountFraction = 0;
let appliedPromoCode = "";
let currentService = "Drafting";
let discountFraction = 0;
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);
let hasVisitedStepTwo = false;

// currency integration
let currentCurrency = session.getItem("currency") || "GBP";
let exchangeRates = {};     // To store latest exchange rates
const currencySymbols = {
  USD: "$",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  CNY: "¥",
};

// Multipliers
const serviceMultipliers = {
  "Drafting": 1,
  "Editing": 0.7,
  "Proofreading": 0.3
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

// -------------------------------------------
// Utilities
// -------------------------------------------
function getDropdownLabel(dropdown, value) {
  const opt = dropdown.options.find(o => (o.value ? o.value === value : o.label === value));
  return opt ? opt.label : "";
}

// updateCurrencyDropdown: Populate the Currency Dropdowns
function updateCurrencyDropdown() {
  const opts = Object.entries(exchangeRates)
                      .map(([code, rate])=>({label:code,value:code}));
  $w('#currencyDropdown').options = opts;
  $w('#currencyDropdown').value   = currentCurrency;
}
function updateCurrencyDropdown1() {
  const opts = Object.entries(exchangeRates)
                      .map(([code, rate])=>({label:code,value:code}));
  $w('#currencyDropdown1').options = opts;
  $w('#currencyDropdown1').value   = currentCurrency;
}

// Core Calculator
function calculator() {
  const levelPrice = web_price_Arr[0];
  const deadlinePrice = web_price_Arr[1];
  let wordCount = wordCount_Arr[0];

  if (wordCount < 250) {
    $w("#originalPrice").html = "-";
    $w("#totalPriceText").text = "Min. 250 words required";
    $w("#discountRateText").text= " 0 %";
    $w("#discountAmountText").text= "0.00";
    $w("#orderDetailsButton").disable();
    return;
  }

  $w("#orderDetailsButton").enable();
  const serviceMultiplier = serviceMultipliers[currentService] || 1;
  // look up the human‐readable label
  const paperLabel = getDropdownLabel($w("#paperTypeDropdown"), $w("#paperTypeDropdown").value);
  // now grab the multiplier by that label
  const paperMultiplier = paperTypeMultipliers[paperLabel] || 1;
  basePrice = levelPrice * deadlinePrice * wordCount * 0.07 * serviceMultiplier * paperMultiplier;

  // convert to selected currency
  const rate = exchangeRates[currentCurrency] || 1;
  const convertedBase = basePrice * rate;

  session.setItem("basePrice", basePrice.toString());
  session.setItem("appliedDiscountFraction", appliedDiscountFraction.toString());

  if (appliedDiscountFraction > 0) {
    // original price display
    $w("#originalPrice").show();
    $w("#originalPrice").html = `
      <div style="text-align: right;">
        <span style="text-decoration: line-through; font-size:12px;color:#3651d0;">
          ${currencySymbols[currentCurrency]} ${convertedBase.toFixed(2)}
        </span>
      </div>`;
    const discountAmt = convertedBase * appliedDiscountFraction;
    const discounted = convertedBase - discountAmt;
    $w("#totalPriceText").text = `${currencySymbols[currentCurrency]} ${discounted.toFixed(2)}`;
    $w("#discountRateText").text = `${(appliedDiscountFraction * 100).toFixed(0)}% OFF`;
    $w("#discountRateText").expand();
    $w("#discountAmountText").text = `- ${currencySymbols[currentCurrency]} ${discountAmt.toFixed(2)}`;
    $w("#discountAmountText").expand();
    session.setItem("discountRate", $w("#discountRateText").text);
    session.setItem("discountAmount", $w("#discountAmountText").text);
  } else {
    $w("#totalPriceText").text = `${currencySymbols[currentCurrency]} ${convertedBase.toFixed(2)}`;
    $w("#originalPrice").hide();
    $w("#discountRateText").collapse();
    $w("#discountAmountText").collapse();
    $w("#youSavedText").hide();
    session.setItem("discountRate", "");
    session.setItem("discountAmount", "");
  }
  session.setItem("totalPrice", $w("#totalPriceText").text);
}

function recalcAndDisplay() {
  discountFraction = parseFloat(session.getItem("appliedDiscountFraction")) || 0;
  const originalGBP = basePrice;
  const rate = exchangeRates[currentCurrency] || 1;
  const original = originalGBP * rate;

  let discountAmt = 0;
  let finalPrice = original;
  if (discountFraction > 0) {
    discountAmt = original * discountFraction;
    finalPrice = original - discountAmt;
    $w("#originalPrice1").show();
    $w("#originalPrice1").html = `
      <div style="text-align: right;">
        <span style="text-decoration: line-through; font-size:12px;color:#3651d0;">
          ${currencySymbols[currentCurrency]} ${original.toFixed(2)}
        </span>
      </div>`;
    $w("#discountRateText1").text = `${(discountFraction * 100).toFixed(0)}% OFF`;
    $w("#discountRateText1").expand();
    $w("#youSavedText1").show();
    $w("#discountAmountText1").text = `- ${currencySymbols[currentCurrency]} ${discountAmt.toFixed(2)}`;
    $w("#discountAmountText1").expand();
  } else {
    $w("#originalPrice1").hide();
    $w("#discountRateText1").collapse();
    $w("#youSavedText1").hide();
    $w("#discountAmountText1").collapse();
  }
  $w("#totalPriceText1").text = `${currencySymbols[currentCurrency]} ${finalPrice.toFixed(2)}`;
  session.setItem("totalPrice", finalPrice.toFixed(2));
}

function loadSubjects(area) {
  // clear any old options & disable while loading
  $w("#subjectDropdown").options = [];
  $w("#subjectDropdown").disable();

  wixData.query("Subjects")
    .eq("title", area)
    .distinct("subject")
    .then((res) => {
      // handle both possible shapes:
      let subjects = [];
      if (Array.isArray(res)) {
        subjects = res;
      } else if (res && Array.isArray(res.items)) {
        subjects = res.items;
      }

      // build options without .map()
      let opts = [];
      for (let i = 0; i < subjects.length; i++) {
        opts.push({ label: subjects[i], value: subjects[i] });
      }

      // set & enable
      $w("#subjectDropdown").options = opts;
      $w("#subjectDropdown").enable();

      // restore saved subject
      const savedSubject = session.getItem("subject");
      if (savedSubject) {
        $w("#subjectDropdown").value = savedSubject;
        $w("#summarySubject").text   = savedSubject;
      }

      // clear red “required” outline
      $w("#subjectDropdown").resetValidityIndication();
    })
    .catch((err) => console.error("Error loading subjects:", err));
}

function updateStepTwoSummaries() {
  $w("#summaryService1").text       = session.getItem("service") || "-";
  $w("#summaryAcademicLevel1").text= session.getItem("academicLevel") || "-";
  $w("#summaryDeadline1").text     = session.getItem("deadline") || "-";
  const wc1 = session.getItem("wordCount");
  $w("#summaryWordCount1").text     = wc1 ? `${wc1} words` : "-";
  $w("#summaryPaperType1").text    = session.getItem("paperType") || "-";
  $w("#summarySubjectArea1").text  = session.getItem("subjectArea") || "-";
  $w("#summarySubject1").text      = session.getItem("subject") || "-";
}

function showStepOne() {
  // sync Step 1 dropdown
  $w("#currencyDropdown").value = currentCurrency;
  // recalc everything on Step 1
  calculator();
  $w("#stepTwo").hide();
  $w("#stepOne").show();
  wixWindow.scrollTo(0, 0);
}

// -------------------------------------------
// Page onReady
// -------------------------------------------

$w.onReady(async () => {
  const isMobile = wixWindow.formFactor === "Mobile";

  // fetch rates and init currency dropdowns
  exchangeRates = await getExchangeRates();
  updateCurrencyDropdown();
  updateCurrencyDropdown1();
  calculator();

  // ───────── Initial step state ─────────
  $w("#stepOne").show();
  $w("#stepTwo").hide();
  initStepOne();
  initStepTwo();

  if ( session.getItem("hasVisitedStepTwo") === "true" ) {
    showStepTwo();
    // also clear any old “required” marks on the Step 2 form:
    $w("#essayTopicInput").resetValidityIndication();
    $w("#assignmentInstructionsInput").resetValidityIndication();
    $w("#referencingStyleDropdown").resetValidityIndication();
    $w("#sourcesInput").resetValidityIndication();
    $w("#emailInput").resetValidityIndication();
  }

  // currency dropdown handlers
  $w("#currencyDropdown").onChange(() => {
    currentCurrency = $w("#currencyDropdown").value;
    session.setItem("currency", currentCurrency);
    // recalc step 1
    calculator();
    // sync step 2 dropdown and recalc step 2
    $w("#currencyDropdown1").value = currentCurrency;
    if (hasVisitedStepTwo) {
      recalcAndDisplay();
    }
  });

  $w("#currencyDropdown1").onChange(() => {
    currentCurrency = $w("#currencyDropdown1").value;
    session.setItem("currency", currentCurrency);
    // recalc step 2
    recalcAndDisplay();
    // sync step 1 dropdown and recalc step 1
    $w("#currencyDropdown").value = currentCurrency;
    calculator();
  });(() => {
    currentCurrency = $w("#currencyDropdown1").value;
    session.setItem("currency", currentCurrency);
    recalcAndDisplay();
  });

  // ───────── Desktop-only UI & handlers ─────────
  if (!isMobile) {
    // collapse the order button (doesn't exist on mobile)
    if ($w("#orderButton")) {
      $w("#orderButton").collapse();
    }

    // hide “addDetails” initially
    if ($w("#addDetailsButton")) {
      $w("#addDetailsButton").hide();
    }

    // “About your order” click → back to step one
    if ($w("#aboutYourOrder")) {
      $w("#aboutYourOrder").onClick(() => {
        $w("#stepTwo").hide();
        $w("#stepOne").show();
        wixWindow.scrollTo(0, 0);
      });
    }

    // “Add details” click → step two
    if ($w("#addDetailsButton")) {
      $w("#addDetailsButton").onClick(() => {
        showStepTwo();
      });
    }
  }

  // ───────── Always-needed handlers ─────────
  if ($w("#orderDetailsButton")) {
    $w("#orderDetailsButton").onClick(() => {
      $w("#orderInfoError").hide();

      // validation
      const missing =
        $w("#summaryAcademicLevel").text === "-" ||
        $w("#summaryDeadline").text === "-" ||
        $w("#summaryPaperType").text === "-" ||
        $w("#summarySubjectArea").text === "-" ||
        $w("#summarySubject").text === "-";

      if (missing) {
        $w("#orderInfoError").text =
          "Please complete all required selections: Paper Type, Subject Area, and Subject.";
        $w("#orderInfoError").show();
        return;
      }

      // recalc & switch
      showStepTwo();

      // on desktop, now reveal the add-details button
      if (!isMobile && $w("#addDetailsButton")) {
        $w("#addDetailsButton").show();
      }
    });
  }

  if ($w("#goBackText")) {
    $w("#goBackText").onClick(() => {
      $w("#stepTwo").hide();
      $w("#stepOne").show();
      wixWindow.scrollTo(0, 0);
    });
  }
});

// ───────── Helpers ─────────
function showStepTwo() {
  updateStepTwoSummaries();

  // pull fresh values from session
  basePrice = parseFloat(session.getItem("basePrice")) || 0;
  discountFraction = parseFloat(session.getItem("appliedDiscountFraction")) || 0;

  // original no-arg call
  recalcAndDisplay();

  $w("#stepOne").hide();
  $w("#stepTwo").show();
  wixWindow.scrollTo(0, 0)
}

// -------------------------------------------
// Switch between steps (handlers remain outside)
// -------------------------------------------
$w("#orderDetailsButton").onClick(() => {
  $w("#orderInfoError").hide();
  const missing =
    $w("#summaryAcademicLevel").text === "-" ||
    $w("#summaryDeadline").text === "-" ||
    $w("#summaryPaperType").text === "-" ||
    $w("#summarySubjectArea").text === "-" ||
    $w("#summarySubject").text === "-";
  if (missing) {
    $w("#orderInfoError").text =
      "Please complete all required selections: Paper Type, Subject Area, and Subject.";
    $w("#orderInfoError").show();
    return;
  }
  updateStepTwoSummaries();
  basePrice = parseFloat(session.getItem("basePrice")) ||   0;
  discountFraction = parseFloat(session.getItem("appliedDiscountFraction")) || 0;
  recalcAndDisplay();
  $w("#stepOne").hide();
  $w("#stepTwo").show();
  hasVisitedStepTwo = true;
  $w("#addDetailsButton").show();
  wixWindow.scrollTo(0, 0);
});

$w("#goBackText").onClick(showStepOne);
$w("#aboutYourOrder").onClick(showStepOne);


$w("#addDetailsButton").onClick(() => {
  updateStepTwoSummaries();
  basePrice = parseFloat(session.getItem("basePrice")) || 0;
  discountFraction = parseFloat(session.getItem("appliedDiscountFraction")) || 0;
  recalcAndDisplay();
  $w("#stepOne").hide();
  $w("#stepTwo").show();
  wixWindow.scrollTo(0, 0);
});

// -------------------------------------------
// Step One Initialization
// -------------------------------------------
function initStepOne() {
  // ───────── Hide/Collapse UI ──────────
  $w("#discountErrorText").hide();
  $w("#discountRateText").collapse();
  $w("#youSavedText").hide();
  $w("#discountAmountText").collapse();
  $w("#orderInfoError").hide();
  $w("#originalPrice").hide();

  // ───────── Rehydrate saved session values ──────────

  // 0) Currency
  const savedCurrency = session.getItem("currency");
  if (savedCurrency) {
    currentCurrency = savedCurrency;
    $w("#currencyDropdown").value = savedCurrency;
  }

  // 1) Academic Level
  const savedLevel = session.getItem("academicLevel");
  if (savedLevel) {
    const lvlOpt = $w("#academicLevel").options.find(o => o.label === savedLevel);
    if (lvlOpt) {
      $w("#academicLevel").value = lvlOpt.value;
      $w("#summaryAcademicLevel").text = savedLevel;
      web_price_Arr[0] = Number(lvlOpt.value);
    }
  }

  // 2) Deadline
  const savedDeadline = session.getItem("deadline");
  if (savedDeadline) {
    const dlOpt = $w("#deadline").options.find(o => o.label === savedDeadline);
    if (dlOpt) {
      $w("#deadline").value = dlOpt.value;
      $w("#summaryDeadline").text = savedDeadline;
      web_price_Arr[1] = Number(dlOpt.value);
    }
  }

  // 3) Word Count
  const savedWC = session.getItem("wordCount");
  if (savedWC) {
    $w("#wordCount").value = savedWC;
    $w("#summaryWordCount").text = `${savedWC} words`;
    wordCount_Arr[0] = Number(savedWC);
  }

  // 4) Service
  const savedService = session.getItem("service");
  if (savedService) {
    currentService = savedService;
    $w("#serviceTag").value = [savedService];
    $w("#summaryService").text = savedService;
  }

  // 7) Discount / Promo Code
  const savedPromo = session.getItem("promoCode");
  if (savedPromo) {
    appliedPromoCode = savedPromo;
    appliedDiscountFraction = parseFloat(session.getItem("appliedDiscountFraction")) || 0;
    $w("#discountCodeInput").value = savedPromo;
    if (appliedDiscountFraction > 0) {
      const discountRateText = session.getItem("discountRate");
      const discountAmountText = session.getItem("discountAmount");
      const totalText = session.getItem("totalPrice");
      if (discountRateText)      { $w("#discountRateText").text = discountRateText; $w("#discountRateText").show(); }
      if (discountAmountText)    { $w("#discountAmountText").text = discountAmountText; $w("#discountAmountText").show(); }
      if (totalText)            { $w("#totalPriceText").text = totalText; }
      $w("#youSavedText").show();
    }
  }

  // ───────── Calculate price now that we’ve rehydrated inputs ──────────
  calculator();

  // --- INITIALIZE SUMMARY VALUES (only if nothing in session) ---
  if (!session.getItem("academicLevel")) {
    $w("#summaryAcademicLevel").text = "Undergraduate";
    session.setItem("academicLevel", "Undergraduate");
  }
  if (!session.getItem("deadline")) {
    $w("#summaryDeadline").text = "10 days";
    session.setItem("deadline", "10 days");
  }
  if (!session.getItem("wordCount")) {
    $w("#summaryWordCount").text = "250 words";
    session.setItem("wordCount", "250");
  }
  if (!session.getItem("paperType")) {
    $w("#summaryPaperType").text = "-";
    session.setItem("paperType", "");
  }
  if (!session.getItem("subjectArea")) {
    $w("#summarySubjectArea").text = "-";
    session.setItem("subjectArea", "");
  }
  if (!session.getItem("subject")) {
    $w("#summarySubject").text = "-";
    session.setItem("subject", "");
  }
  if (!session.getItem("service")) {
    $w("#summaryService").text = "Drafting";
    session.setItem("service", "Drafting");
  }
  // set up serviceTag options & default if needed
  $w("#serviceTag").options = [
    { label: "Drafting",         value: "Drafting" },
    { label: "Editing",          value: "Editing" },
    { label: "Proofreading",  value: "Proofreading" }
  ];
  if (!session.getItem("service")) {
    $w("#serviceTag").value = ["Draft"];
  }

  // -------------------------------------------------------------------
  // Service (Custom Single Selection with Session)
  // -------------------------------------------------------------------
  $w("#summaryService").text = "Drafting";
  session.setItem("service", "Drafting");

  $w("#serviceTag").options = [
    { label: "Drafting",         value: "Drafting" },
    { label: "Editing",          value: "Editing" },
    { label: "Proofreading",  value: "Proofreading" }
  ];
  $w("#serviceTag").value = ["Drafting"];
  $w("#serviceTag").onChange((event) => {
    const selectedValues = event.target.value;
    if (selectedValues.length > 1) {
      const lastSelected = selectedValues[selectedValues.length - 1];
      $w("#serviceTag").value = [lastSelected];
    }
    if ($w("#serviceTag").value.length > 0) {
      currentService = $w("#serviceTag").value[0];
      $w("#summaryService").text = currentService;
      session.setItem("service", currentService);
      calculator(); 
    }
  });

  session.setItem("basePrice", basePrice.toString());
  session.setItem("appliedDiscountFraction", appliedDiscountFraction.toString());
  session.setItem("totalPrice", $w("#totalPriceText").text);

  // -------------------------------
  // Academic Level Dropdown Handler
  // -------------------------------
  const levelMap = {
    "0.8": 0.8,
    "1.3": 1.3,
    "1.5": 1.5,
    "1.8": 1.8,
  };
  $w("#academicLevel").onChange(() => {
    const levelValue = $w("#academicLevel").value;
    if (Object.prototype.hasOwnProperty.call(levelMap, levelValue)) {
      web_price_Arr[0] = levelMap[levelValue];
    }
    calculator();
    const label = getDropdownLabel($w("#academicLevel"), levelValue);
    $w("#summaryAcademicLevel").text = label;
    session.setItem("academicLevel", label);
  });

  // -------------------------------
  // Deadline Dropdown Handler
  // -------------------------------
  const deadlineMap = {
    "1": 1,
    "1.2": 1.2,
    "1.4": 1.4,
    "1.6": 1.6,
    "1.8": 1.8,
    "2": 2,
  };
  $w("#deadline").onChange(() => {
    const deadlineValue = $w("#deadline").value;
    if (Object.prototype.hasOwnProperty.call(deadlineMap, deadlineValue)) {
      web_price_Arr[1] = deadlineMap[deadlineValue];
    }
    calculator();
    const label = getDropdownLabel($w("#deadline"), deadlineValue);
    $w("#summaryDeadline").text = label;
    session.setItem("deadline", label);
  });

  // -------------------------------
  // Word Count Input Handler
  // -------------------------------
  $w("#wordCount").onInput(() => {
  const value = Number($w("#wordCount").value);
  wordCount_Arr[0] = isNaN(value) ? 0 : value;

  if (value < 250 || isNaN(value)) {
    $w("#summaryWordCount").text = "-";
  } else {
    $w("#summaryWordCount").text = `${value} words`;
  }

  session.setItem("wordCount", $w("#wordCount").value);
  calculator();
});

  // -------------------------------
  // Paper Type Dropdown Setup & Handler
  // -------------------------------
  $w('#paperTypeDropdown').options = [
    { label: "Annotated Bibliography", value: "annotated_bibliography" },
    { label: "Case Study", value: "case_study" },
    { label: "Critical Review", value: "critical_review" },
    { label: "Dissertation", value: "dissertation" },
    { label: "Dissertation Chapter (give chapter later)", value: "dissertation_chapter" },
    { label: "Essay (give type later)", value: "essay_general" },
    { label: "Literature Review", value: "literature_review" },
    { label: "Policy Brief", value: "policy_brief" },
    { label: "Position Paper", value: "position_paper" },
    { label: "Reflection Paper", value: "reflection_paper" },
    { label: "Report", value: "report" },
    { label: "Research Paper", value: "research_paper" },
    { label: "Research Proposal", value: "research_proposal" }
  ];

  const savedPaper = session.getItem("paperType");
  if (savedPaper) {
    const ptOpt = $w("#paperTypeDropdown").options.find(o => o.label === savedPaper);
    if (ptOpt) {
      $w("#paperTypeDropdown").value = ptOpt.value;
      $w("#summaryPaperType").text = savedPaper;
    }
  }

  $w("#paperTypeDropdown").onChange(() => {
  const paperValue = $w("#paperTypeDropdown").value;
  const label = getDropdownLabel($w("#paperTypeDropdown"), paperValue);
  $w("#summaryPaperType").text = label;
  session.setItem("paperType", label);

  // 🛠️ Force "30 days" deadline and disable dropdown for Dissertation/Research Paper
  if (label === "Dissertation" || label === "Research Paper") {
    // 1️⃣ Inject a single “30 days” option
    $w("#deadline").options = [
      { label: "30 days", value: "30 days" }
    ];

    // 2️⃣ Select it, update summary & multiplier
    $w("#deadline").value       = "30 days";
    $w("#summaryDeadline").text = "30 days";
    web_price_Arr[1]            = deadlineMap["1"];
    session.setItem("deadline", "30 days");

    // 3️⃣ Disable the control so it can’t be changed
    $w("#deadline").disable();
  } else {
    // Restore the normal list of deadlines
    $w("#deadline").options = [
      { label: "24 hrs",    value: "2"   },
      { label: "2 days",   value: "1.8" },
      { label: "3 days",   value: "1.6" },
      { label: "5 days",   value: "1.4" },
      { label: "7 days",  value: "1.2" },
      { label: "10 days",  value: "1"   }
    ];
    $w("#deadline").enable();
    web_price_Arr[1]            = deadlineMap["1"];
    $w("#deadline").value       = "1";
    $w("#summaryDeadline").text = "10 days";
    session.setItem("deadline", "10 days");
  }


  // Recalculate price
  calculator();
  if (hasVisitedStepTwo) {
    recalcAndDisplay();
  }
});

  // -------------------------------
  // Keyboard Search for Paper Type
  // -------------------------------
  $w("#searchHelperInput").hide();
  $w("#searchHelperInput").onKeyPress((event) => {
    const typedChar = event.key.toUpperCase();
    const match = $w('#paperTypeDropdown').options.find(option =>
      option.label.trim().toUpperCase().startsWith(typedChar)
    );
    if (match) {
      $w("#paperTypeDropdown").value = match.value;
    }
  });

  // -------------------------------
  // Subject Dropdown (Dynamic Loading)
  // -------------------------------
  // start subject disabled
  $w("#subjectDropdown").disable();

  // 1) load all subject areas
  wixData.query("Subjects")
    .distinct("title")
    .then((res) => {
      let areas = [];
      if (Array.isArray(res)) {
        areas = res;
      } else if (res && Array.isArray(res.items)) {
        areas = res.items;
      }

      // build area options
      let areaOpts = [];
      for (let i = 0; i < areas.length; i++) {
        areaOpts.push({ label: areas[i], value: areas[i] });
      }
      $w("#subjectAreaDropdown").options = areaOpts;

      // if user has a saved area, restore it
      const savedArea = session.getItem("subjectArea");
      if (savedArea) {
        $w("#subjectAreaDropdown").value = savedArea;
        $w("#summarySubjectArea").text   = savedArea;
        $w("#subjectAreaDropdown").resetValidityIndication();

        // then load that area’s subjects
        loadSubjects(savedArea);
      }
    })
    .catch((err) => console.error("Error loading subject areas:", err));

  // 2) user changes area
  $w("#subjectAreaDropdown").onChange((e) => {
    const area = e.target.value;
    session.setItem("subjectArea", area);
    $w("#summarySubjectArea").text = area;
    $w("#subjectAreaDropdown").resetValidityIndication();
    loadSubjects(area);
  });

  // 3) user picks subject
  $w("#subjectDropdown").onChange((e) => {
    const subj = e.target.value;
    session.setItem("subject", subj);
    $w("#summarySubject").text = subj;
    $w("#subjectDropdown").resetValidityIndication();
  });

  // -------------------------------
  // Discount Code Logic
  // -------------------------------
  const validPromoCodes = {
    "BONUS15": 0.15,
  };
  $w("#discountErrorText").hide();
  $w("#discountRateText").collapse();
  $w("#youSavedText").hide();
  $w("#discountAmountText").collapse();

  $w("#applyButton").onClick(() => {
    const enteredCode = $w("#discountCodeInput").value.trim().toUpperCase();
    if (Object.prototype.hasOwnProperty.call(validPromoCodes, enteredCode)) {
      $w("#discountErrorText").hide();
      appliedDiscountFraction = validPromoCodes[enteredCode];
      appliedPromoCode = enteredCode;
      const discountAmount = basePrice * appliedDiscountFraction;
      const discountedPrice = basePrice - discountAmount;
      $w("#totalPriceText").text = `£ ${discountedPrice.toFixed(2)}`;
      const discountPercent = (appliedDiscountFraction * 100).toFixed(0);
      $w("#discountRateText").text = `${discountPercent}% OFF`;
      $w("#discountRateText").expand();
      $w("#youSavedText").show();
      $w("#discountAmountText").text = `£ ${discountAmount.toFixed(2)}`;
      $w("#discountAmountText").expand();
      session.setItem("discountRate", $w("#discountRateText").text);
      session.setItem("discountAmount", $w("#discountAmountText").text);
      session.setItem("promoCode", enteredCode);
      session.setItem("appliedDiscountFraction", appliedDiscountFraction.toString());
    } else {
      $w("#discountErrorText").text = "Invalid promo code";
      $w("#discountErrorText").show();
      appliedDiscountFraction = 0;
      appliedPromoCode = "";
      $w("#discountRateText").collapse();
      $w("#youSavedText").hide();
      $w("#discountAmountText").collapse();
      $w("#totalPriceText").text = `£ ${Number(basePrice).toLocaleString()}`;
      session.setItem("discountRate", "");
      session.setItem("discountAmount", "");
      session.setItem("promoCode", "");
      session.setItem("appliedDiscountFraction", "0");
    }
    session.setItem("totalPrice", $w("#totalPriceText").text);
  });
}

// -------------------------------------------
// Step Two Initialization
// -------------------------------------------
function initStepTwo() {
  // Restore saved currency
  const savedCurrency = session.getItem("currency");
  if (savedCurrency) {
    currentCurrency = savedCurrency;
    $w("#currencyDropdown1").value = savedCurrency;
  }

  // 1) Essay topic
  const savedTopic = session.getItem("essayTopic") || "";
  if (savedTopic) {
    $w("#essayTopicInput").value = savedTopic;
    $w("#essayTopicInput").resetValidityIndication();
  }

  // 2) Assignment instructions
  const savedInstructions = session.getItem("instructions") || "";
  if (savedInstructions) {
    $w("#assignmentInstructionsInput").value = savedInstructions;
    $w("#assignmentInstructionsInput").resetValidityIndication();
  }

  // 3) Referencing style
  const savedStyle = session.getItem("referencingStyle") || "";
  if (savedStyle) {
    $w("#referencingStyleDropdown").value = savedStyle;
    $w("#referencingStyleDropdown").resetValidityIndication();
  }

  // 4) Sources
  const savedSources = session.getItem("sources") || "";
  if (savedSources) {
    $w("#sourcesInput").value = savedSources;
    $w("#sourcesInput").resetValidityIndication();
  }

  // 5) Email
  const savedEmail = session.getItem("email") || "";
  if (savedEmail) {
    $w("#emailInput").value = savedEmail;
    $w("#emailInput").resetValidityIndication();
  }

  // Clear any previous error messages
  $w("#orderDetailsError").hide();
  if ($w("#emailError")) {
    $w("#emailError").hide();
  }

  // Keep session synced
  $w("#essayTopicInput").onInput(() =>
    session.setItem("essayTopic", $w("#essayTopicInput").value)
  );
  $w("#assignmentInstructionsInput").onInput(() =>
    session.setItem("instructions", $w("#assignmentInstructionsInput").value)
  );
  $w("#referencingStyleDropdown").onChange(() =>
    session.setItem("referencingStyle", $w("#referencingStyleDropdown").value)
  );
  $w("#sourcesInput").onInput(() =>
    session.setItem("sources", $w("#sourcesInput").value)
  );
  $w("#emailInput").onInput(() =>
    session.setItem("email", $w("#emailInput").value)
  );

  // Pay button handler (unchanged)
  $w("#payButton").onClick(async () => {
    const essayTopic = $w("#essayTopicInput").value.trim();
    const instructions = $w("#assignmentInstructionsInput").value.trim();
    const referencingStyle = $w("#referencingStyleDropdown").value;
    const sources = $w("#sourcesInput").value.trim();
    const email = $w("#emailInput").value.trim();

    if (!essayTopic || !instructions || !referencingStyle || !sources || !email) {
      $w("#orderDetailsError").text = "Please fill in all required fields.";
      $w("#orderDetailsError").show();
      return;
    }
    $w("#orderDetailsError").hide();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      $w("#emailError").text = "Please enter a valid email address.";
      $w("#emailError").show();
      return;
    }
    $w("#emailError").hide();

  // 2️⃣ Create the Orders record
  const orderNumber = `ORD-${nanoid()}`;
  const orderData = {
    orderNumber,
    essayTopic,
    instructions,
    service:                  session.getItem("service"),
    referencingStyle:         session.getItem('referencingStyle'),
    sources:                  session.getItem('sources'),
    academicLevel:            session.getItem('academicLevel'),
    deadline:                 session.getItem('deadline'),
    wordCount:                session.getItem('wordCount'),
    appliedDiscountFraction:  session.getItem('appliedDiscountFraction'),
    paperType:                session.getItem('paperType'),
    subjectArea:              session.getItem('subjectArea'),
    subject:                  session.getItem('subject'),
    paymentAmount:            session.getItem('totalPrice'),  // placeholder
    currency:                 currentCurrency,
    status:                   'Pending',
    email:                    $w('#emailInput').value.trim(),
    documents:                []
  };

  let inserted;
  try {
    inserted = await createOrder(orderData);
  } catch (e) {
    console.warn('Order creation failed (we’ll still go to Stripe):', e);
  }

  const orderRecordId = inserted?._id;
  if (!orderRecordId) {
    console.error('No orderRecordId; aborting payment');
    return;
  }
  session.setItem('orderRecordId', orderRecordId);

  // 3️⃣ Kick off Stripe Checkout
  const payload = {
    orderRecordId,
    orderNumber,
    service:                  orderData.service,
    academicLevel:            orderData.academicLevel,
    deadline:                 orderData.deadline,
    wordCount:                orderData.wordCount,
    appliedDiscountFraction:  orderData.appliedDiscountFraction,
    currency:                 orderData.currency,
    paperType:                orderData.paperType
  };

  let resp;
  try {
    resp = await createPayment(payload);
  } catch (err) {
    console.error('Stripe session creation failed:', err);
    wixLocation.to("/payment-failed");
  }

  if (!resp.sessionUrl) {
      $w('#orderDetailsError').text = 'No checkout URL returned.';
      return $w('#orderDetailsError').show();
    }
    session.setItem("hasVisitedStepTwo","true");
    wixLocation.to(resp.sessionUrl);
});
}
