import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddressShort(address?: string) {
  if (!address) {
    return "????..????";
  }
  const normalized = address.replace(/^0x/i, "");
  if (normalized.length <= 8) {
    return normalized.toUpperCase();
  }
  const start = normalized.slice(0, 4).toUpperCase();
  const end = normalized.slice(-4).toUpperCase();
  return `${start}..${end}`;
}

export function seedFromAddress(address?: string) {
  if (!address) return 0;
  let hash = 0;
  for (let index = 0; index < address.length; index += 1) {
    hash = (hash << 5) - hash + address.charCodeAt(index);
    hash |= 0;
  }
  return hash >>> 0;
}
