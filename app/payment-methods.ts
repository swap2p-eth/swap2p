type PaymentMethodsByCountry = Record<string, string[]>;

const EUR_METHODS: string[] = [
  "SEPA Transfer",
  "SEPA Instant",
  "Revolut",
  "Wise",
];

export const BANK_TRANSFER_LABEL = "Bank transfer";

const uniq = (methods: readonly string[]) => {
  const result: string[] = [];
  for (const method of methods) {
    if (!result.includes(method)) {
      result.push(method);
    }
  }
  return result;
};

// Only P2P methods - when citizen can transfer to another citizen
export const PAYMENT_METHODS: PaymentMethodsByCountry = {
  AM: ["Idram", "TelCell"],
  AR: ["Mercado Pago", "Cash deposit"],
  BD: ["bKash", "Nagad"],
  BR: ["Pix", "Mercado Pago", "PicPay"],
  BY: ["QIWI Wallet", "WebMoney"],
  EE: ["Revolut", "Wise"],
  ET: ["Telebirr"],
  FI: ["Revolut"],
  GB: ["Revolut"],
  GE: ["TBC Bank", "Bank of Georgia", "Wise"],
  HK: ["FPS transfer", "Alipay HK", "WeChat Pay HK"],
  ID: ["BCA", "Bank Mandiri", "OVO", "GoPay", "DANA"],
  JO: ["Arab Bank", "Cairo Amman Bank", "Western Union", "Cash pickup"],
  JP: ["Domestic furikomi", "PayPay", "LINE Pay"],
  KG: ["Elcart", "QIWI Wallet"],
  KH: ["Wing Money", "Pi Pay"],
  KR: ["KB Kookmin Bank", "Shinhan Bank", "KakaoPay", "Toss"],
  LV: ["Revolut", "Wise"],
  MD: ["MAIB", "Victoriabank", "Paynet Wallet", "Western Union"],
  ME: ["IBAN transfer", "Wise"],
  NG: ["Access Bank", "Zenith Bank", "OPay", "Kuda"],
  PH: ["UnionBank", "GCash", "Maya"],
  PK: ["JazzCash", "Easypaisa", "NayaPay"],
  PT: ["MB Way", "Revolut"],
  RU: ["QIWI Wallet", "YooMoney"],
  SG: ["PayNow/FAST", "GrabPay"],
  SI: ["Revolut"],
  TH: [
    "Bangkok Bank",
    "Kasikorn Bank",
    "Siam Commercial Bank",
    "Krungthai Bank",
    "Krungsri",
    "TMBThanachart (TTB)",
    "CIMB Thai",
    "PromptPay",
    "TrueMoney Wallet",
  ],
  TR: ["Ziraat Bank", "Isbank", "Papara"],
  UA: ["Monobank", "PrivatBank", "Oschadbank"],
  US: [
    "Zelle",
    "Venmo",
    "Cash App",
    "Apple Cash",
    "Google Pay Balance",
    "Chime Pay Friends",
    "Facebook Pay",
  ],
  VE: ["Bolivares transfer", "Zelle"],
  VN: ["Vietcombank", "Techcombank", "MoMo", "Viettel Money"],
  YE: ["Cash in person", "Western Union"],
};

export const getPaymentMethodsForCountry = (countryCode?: string): string[] => {
  const key = typeof countryCode === "string" ? countryCode.trim().toUpperCase() : "";
  const base = key ? PAYMENT_METHODS[key] ?? [] : [];
  const normalized = uniq(base.map(method => method.trim()).filter(Boolean));
  const withoutBank = normalized.filter(method => method !== BANK_TRANSFER_LABEL);
  return [BANK_TRANSFER_LABEL, ...withoutBank];
};
