type PaymentMethodsByCountry = Record<string, string[]>;

const EUR_METHODS: string[] = [
  "SEPA Transfer",
  "SEPA Instant",
  "Revolut",
  "Wise",
];

// Only P2P methods - when citizen can transfer to another citizen
export const PAYMENT_METHODS: PaymentMethodsByCountry = {
  // TODO complete for US, TH and other countries
  US: [
    "Zelle",
    "Venmo",
    "Cash App",
    "PayPal",
    "Apple Cash",
    "Google Pay Balance",
    "Chime Pay Friends",
    "Facebook Pay",
  ],
  TH: [
    "Bangkok Bank",
    "Kasikorn Bank",
    "Siam Commercial Bank (SCB)",
    "Krungthai Bank",
    "Krungsri (Bank of Ayudhya)",
    "TMBThanachart (TTB)",
    "CIMB Thai",
    "PromptPay",
    "TrueMoney Wallet",
  ],
}
