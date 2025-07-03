import { webMethod, Permissions } from 'wix-web-module';
import wixData from 'wix-data';

const BYPASS = { suppressAuth: true };

/**
 * Finds a specific order by email and order number.
 * Can be safely called from the frontend using webMethod.
 */
export const getOrderByEmailAndNumber = webMethod(Permissions.Anyone, async (email, orderNumber) => {
  try {
    const result = await wixData.query("Orders")
      .eq("email", email)
      .eq("orderNumber", orderNumber)
      .limit(1)
      .find(BYPASS);

    if (result.items.length > 0) {
      return result.items[0];
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching order:", error);
    throw new Error("Unable to fetch order.");
  }
});

export const updateOrderDetails = webMethod(
  Permissions.Anyone, 
  /**
   * @param {Object} params
   * @param {string} params.email
   * @param {string} params.orderNumber
   * @param {Object} params.fields  // only the fields you want to update
   */
  async ({ email, orderNumber, fields }) => {
    // 1. look up the order by email+orderNumber
    const { items } = await wixData
      .query("Orders")
      .eq("email", email)
      .eq("orderNumber", orderNumber)
      .limit(1)
      .find(BYPASS);

    if (!items.length) {
      throw new Error("Order not found");
    }

    const order = items[0];

    // 2. merge in only the fields you were given
    const toUpdate = {
      ...order,
      ...fields,
      _id: order._id   // required by wixData.update
    };

    // 3. write back
    return wixData.update("Orders", toUpdate, BYPASS);
  }
);
