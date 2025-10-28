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

export async function copyToClipboard(value: string): Promise<boolean> {
  if (!value) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // ignore and fallback below
  }

  if (typeof document === "undefined") {
    return false;
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}
