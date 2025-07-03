import { Permissions, webMethod } from 'wix-web-module';
import wixData                       from 'wix-data';
import { contacts }                  from 'wix-crm-backend';
import wixCrm                        from 'wix-crm-backend';
import { triggeredEmails }           from 'wix-crm-backend';

const BYPASS = { suppressAuth: true };

// 1️⃣ Create the order (no docs yet)
export const createOrder = webMethod(
  Permissions.Anyone,
  async (orderData) => {
    // Wix will generate the _id
    const inserted = await wixData.insert('Orders', orderData, BYPASS);
    return inserted;
  }
);

// 2️⃣ After payment: read, merge in paymentId + status + docs array, then update
export const handlePaymentUpdate = webMethod(
  Permissions.Anyone,
  async (sessionId, orderNumber) => {
    // 1) Fetch the order
    const orderResults = await wixData.query("Orders")
      .eq("orderNumber", orderNumber)
      .limit(1)
      .find(BYPASS);

    if (!orderResults.items.length) {
      console.error("No order found with orderNumber:", orderNumber);
      throw new Error("Order not found.");
    }

    const order = orderResults.items[0];

    // 2) Patch it with the payment info
    const patched = {
      ...order,
      title:  sessionId,
      status: 'Successful',
      paidAt:  new Date()
    };
    await wixData.update("Orders", patched, BYPASS);

    // 3) Elevate, but catch *all* errors inside the callback
    let contactId = null;

    try {
      // 1. Find contact using suppressAuth
      const { items } = await contacts
        .queryContacts()
        .eq('primaryInfo.email', order.email)
        .find(BYPASS);

    if (items.length) {
      contactId = items[0]._id;
    } else {
      // 2. Create contact (returns ID string directly)
      contactId = await wixCrm.createContact({ emails: [order.email] });
    }
    } catch (err) {
      console.error("❌ Error during contact creation/query:", err);
      contactId = null;
    }

    // 4) Only send email if we successfully got a contact ID
    if (contactId) {
      try {
        const contact = await contacts.getContact(contactId, { suppressAuth: true });

        // Optional delay to avoid race condition
        await new Promise(r => setTimeout(r, 1000));

        await triggeredEmails.emailContact("UiHkvUw", contactId, {
          variables: { orderNumber }
      });
    } catch (emailErr) {
      console.error("❌ Email error:", emailErr);
    }
    }
  }
);
