const DEFAULT_LOCALE = "en-US";

const DEFAULT_FIAT_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
};

const DEFAULT_PRICE_OPTIONS: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4
};

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale: string = DEFAULT_LOCALE
) {
  return value.toLocaleString(locale, options);
}

export function formatFiatAmount(value: number, options?: Intl.NumberFormatOptions) {
  return formatNumber(value, { ...DEFAULT_FIAT_OPTIONS, ...options });
}

export function formatPrice(value: number, options?: Intl.NumberFormatOptions) {
  return formatNumber(value, { ...DEFAULT_PRICE_OPTIONS, ...options });
}

export function formatTokenAmount(value: number, decimals: number, options?: Intl.NumberFormatOptions) {
  const tokenOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: Math.min(2, decimals),
    maximumFractionDigits: decimals
  };
  return formatNumber(value, { ...tokenOptions, ...options });
}
