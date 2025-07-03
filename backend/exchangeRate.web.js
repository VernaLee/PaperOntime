import { webMethod, Permissions } from 'wix-web-module';
import { fetch }                 from 'wix-fetch';

export const getExchangeRates = webMethod(
  Permissions.Anyone,
  async () => {
    const res  = await fetch('https://open.er-api.com/v6/latest/GBP', { method: 'get' });
    const data = await res.json();
    if (!data || !data.rates) {
      throw new Error('Invalid data format from exchange API.');
    }

    // only include the currencies you support
    const supported = ['GBP','USD','CAD','AUD','CNY'];
    const fx = {};
    supported.forEach(code => {
      fx[code] = data.rates[code] || 1;
    });
    return fx;
  }
);
