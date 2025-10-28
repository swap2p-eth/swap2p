const USD_METHODS: string[] = [
  "Wire (Fedwire)",
  "ACH",
  "Zelle",
  "Wire",
  "Silvergate SEN",
  "Signet",
];

const EUR_METHODS: string[] = [
  "SEPA",
  "SEPA Instant",
  "Revolut Business",
  "SWIFT EUR",
];

const BRL_METHODS: string[] = ["PIX", "TED", "Itau Transfer"];

const GBP_METHODS: string[] = ["Faster Payments", "SWIFT GBP", "Revolut"];

const JPY_METHODS: string[] = ["Domestic Transfer", "SWIFT JPY"];

const MXN_METHODS: string[] = ["SPEI", "Banorte Transfer"];

const CLP_METHODS: string[] = ["WebPay", "BancoEstado"];

export const PAYMENT_METHODS: Record<string, readonly string[]> = Object.freeze({
  US: USD_METHODS,
  UM: USD_METHODS,
  PR: USD_METHODS,
  GU: USD_METHODS,
  AS: USD_METHODS,
  VI: USD_METHODS,
  FM: USD_METHODS,
  MH: USD_METHODS,
  MP: USD_METHODS,
  PW: USD_METHODS,
  EU: EUR_METHODS,
  AT: EUR_METHODS,
  BE: EUR_METHODS,
  CY: EUR_METHODS,
  DE: EUR_METHODS,
  EE: EUR_METHODS,
  ES: EUR_METHODS,
  FI: EUR_METHODS,
  FR: EUR_METHODS,
  GR: EUR_METHODS,
  IE: EUR_METHODS,
  IT: EUR_METHODS,
  LT: EUR_METHODS,
  LU: EUR_METHODS,
  LV: EUR_METHODS,
  MT: EUR_METHODS,
  NL: EUR_METHODS,
  PT: EUR_METHODS,
  SI: EUR_METHODS,
  SK: EUR_METHODS,
  AD: EUR_METHODS,
  MC: EUR_METHODS,
  ME: EUR_METHODS,
  SM: EUR_METHODS,
  VA: EUR_METHODS,
  BR: BRL_METHODS,
  GB: GBP_METHODS,
  GG: GBP_METHODS,
  JE: GBP_METHODS,
  IM: GBP_METHODS,
  JP: JPY_METHODS,
  MX: MXN_METHODS,
  CL: CLP_METHODS,
});
