import { webMethod, Permissions } from 'wix-web-module';
import wixData                     from 'wix-data';

export const getOrderByPaymentId = webMethod(
  Permissions.Anyone,
  async (paymentId) => {
    const results = await wixData
      .query("Orders")
      .eq("title", paymentId)
      .limit(1)
      .find({ suppressAuth: true });

    return results.items[0] || null;
  }
);
