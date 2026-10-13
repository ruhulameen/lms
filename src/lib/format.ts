// The currencies the site can sell in (Settings > Payments). All three count
// in hundredths, which the pence arithmetic in src/lib/commerce.ts relies on.
export const currencies = {
  GBP: { symbol: "£", label: "British pound (£)" },
  USD: { symbol: "$", label: "US dollar ($)" },
  EUR: { symbol: "€", label: "Euro (€)" },
} as const;

export type CurrencyCode = keyof typeof currencies;
export const currencyCodes = Object.keys(currencies) as CurrencyCode[];
export const DEFAULT_CURRENCY: CurrencyCode = "GBP";

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && value in currencies;
}

// The site's currency. One value for the whole site, kept on globalThis so
// server and browser code read it the same way: the settings store sets it on
// the server, the root layout hands it to the browser before anything renders.
export function siteCurrency(): CurrencyCode {
  const code = (globalThis as { __lmsCurrency?: string }).__lmsCurrency;
  return isCurrencyCode(code) ? code : DEFAULT_CURRENCY;
}

// "£", "$" or "€": the site's, or that of the code given.
export function currencySymbol(code?: string) {
  return currencies[isCurrencyCode(code) ? code : siteCurrency()].symbol;
}

export function formatPrice(amount: number) {
  return `${currencySymbol()}${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

export function formatCount(count: number) {
  return count.toLocaleString("en-GB");
}

export function unsplash(id: string, width: number) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
}
