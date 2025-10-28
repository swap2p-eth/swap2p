type PaymentMethodsByCountry = Record<string, string[]>;

const EUR_METHODS: string[] = [
  "SEPA Transfer",
  "SEPA Instant",
  "Revolut",
  "Wise",
];

export const PAYMENT_METHODS: PaymentMethodsByCountry = {
  // TODO complete for US, TH and other countries
  US: ["Fedwire", "ACH", "Zelle", "Venmo"],
  TH: ["Bangkok Bank", "Kasikorn", "PromptPay"],
}
