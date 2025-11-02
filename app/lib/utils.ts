import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getAddress, isAddress } from "viem";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CONTROL_CHARS_WITH_NEWLINE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const CONTROL_CHARS_ALL = /[\u0000-\u001F\u007F]/g;

type SanitizeOptions = {
  maxLength?: number;
  allowLineBreaks?: boolean;
  trimEdges?: boolean;
};

export function sanitizeUserText(value: string, options: SanitizeOptions = {}) {
  if (typeof value !== "string") return "";
  const {
    maxLength = 512,
    allowLineBreaks = true,
    trimEdges = true,
  } = options;
  const controlPattern = allowLineBreaks ? CONTROL_CHARS_WITH_NEWLINE : CONTROL_CHARS_ALL;
  let sanitized = value.replace(controlPattern, "");
  if (allowLineBreaks) {
    sanitized = sanitized.replace(/[ \t]+/g, " ");
    sanitized = sanitized.replace(/\s*\n\s*/g, "\n");
  } else {
    sanitized = sanitized.replace(/\s+/g, " ");
  }
  if (trimEdges) {
    sanitized = sanitized.trim();
  }
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  return sanitized;
}

export function sanitizeDisplayText(value: string, options: SanitizeOptions = {}) {
  const { maxLength = 256, allowLineBreaks = false } = options;
  return sanitizeUserText(value, { maxLength, allowLineBreaks });
}

export function normalizeEvmAddress(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isAddress(trimmed, { strict: false })) return null;
  try {
    return getAddress(trimmed);
  } catch {
    return null;
  }
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
