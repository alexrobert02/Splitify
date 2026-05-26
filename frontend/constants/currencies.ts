export const CURRENCIES = [
  { code: 'RON', name: 'Romanian Leu' },
  { code: 'EUR', name: 'Euro' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'HUF', name: 'Hungarian Forint' },
  { code: 'BGN', name: 'Bulgarian Lev' },
  { code: 'PLN', name: 'Polish Złoty' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
] as const;

export type CurrencyCode = typeof CURRENCIES[number]['code'];
