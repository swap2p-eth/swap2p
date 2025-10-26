declare module "currency-codes/data" {
  interface CurrencyCodesEntry {
    code?: string;
    currency?: string;
    digits?: number;
    countries?: string[];
  }

  const data: CurrencyCodesEntry[];
  export default data;
}
