import { z } from "zod";

import { sanitizeUserText } from "@/lib/utils";

export const PAYMENT_METHOD_MAX_LENGTH = 64;
export const PAYMENT_METHOD_MAX_COUNT = 20;
export const PAYMENT_DETAILS_MIN_LENGTH = 5;
export const PAYMENT_DETAILS_MAX_LENGTH = 512;
export const REQUIREMENTS_MAX_LENGTH = 1_024;
export const CHAT_MESSAGE_MAX_LENGTH = 128;
export const TOKEN_SYMBOL_MAX_LENGTH = 64;
export const COUNTRY_CODE_LENGTH = 2;

export const sanitizePaymentMethod = (value: string) =>
  sanitizeUserText(value, { maxLength: PAYMENT_METHOD_MAX_LENGTH, allowLineBreaks: false });

export const sanitizePaymentMethods = (methods: string[]) => {
  const seen = new Set<string>();
  const sanitized: string[] = [];
  for (const method of methods) {
    const clean = sanitizePaymentMethod(method);
    if (!clean) continue;
    const normalized = clean.trim();
    if (!normalized) continue;
    if (seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    sanitized.push(normalized);
    if (sanitized.length >= PAYMENT_METHOD_MAX_COUNT) break;
  }
  return sanitized;
};

export const sanitizeRequirements = (value: string) =>
  sanitizeUserText(value, { maxLength: REQUIREMENTS_MAX_LENGTH, allowLineBreaks: true });

export const sanitizeDealNote = (value: string) =>
  sanitizeUserText(value, { maxLength: PAYMENT_DETAILS_MAX_LENGTH, allowLineBreaks: true });

export const sanitizeTokenSymbol = (value: string) =>
  sanitizeUserText(value, { maxLength: TOKEN_SYMBOL_MAX_LENGTH, allowLineBreaks: false }).toUpperCase();

export const sanitizeCountryCode = (value: string) =>
  sanitizeUserText(value, { maxLength: COUNTRY_CODE_LENGTH, allowLineBreaks: false }).toUpperCase();

export const sanitizeChatMessage = (value: string) =>
  sanitizeUserText(value, { maxLength: CHAT_MESSAGE_MAX_LENGTH, allowLineBreaks: false });

const finiteNumber = (message: string) =>
  z
    .number({ invalid_type_error: message })
    .refine(value => Number.isFinite(value), { message })
    .refine(value => value > 0, { message: `${message} must be positive.` });

export const DealRequestSchema = z
  .object({
    amount: finiteNumber("Amount"),
    paymentMethod: z
      .string()
      .min(1, "Payment method is required.")
      .max(PAYMENT_METHOD_MAX_LENGTH, "Payment method is too long."),
    paymentDetails: z
      .string()
      .min(PAYMENT_DETAILS_MIN_LENGTH, `Payment details must be at least ${PAYMENT_DETAILS_MIN_LENGTH} characters.`)
      .max(PAYMENT_DETAILS_MAX_LENGTH, "Payment details are too long."),
  })
  .strict();

export const OfferFormSchema = z
  .object({
    side: z.enum(["BUY", "SELL"]),
    token: z
      .string()
      .min(1, "Token is required.")
      .max(TOKEN_SYMBOL_MAX_LENGTH, "Token symbol is too long."),
    countryCode: z
      .string()
      .length(COUNTRY_CODE_LENGTH, "Country code must include two letters.")
      .regex(/^[A-Z]{2}$/, "Country code must contain only letters."),
    price: finiteNumber("Price"),
    minAmount: finiteNumber("Minimum amount"),
    maxAmount: finiteNumber("Maximum amount"),
    paymentMethods: z
      .array(
        z
          .string()
          .min(1, "Payment method is required.")
          .max(PAYMENT_METHOD_MAX_LENGTH, "Payment method is too long."),
      )
      .max(PAYMENT_METHOD_MAX_COUNT, `Use up to ${PAYMENT_METHOD_MAX_COUNT} payment methods.`),
    requirements: z.string().max(REQUIREMENTS_MAX_LENGTH, "Requirements are too long."),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.maxAmount < data.minAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maximum amount must be greater than or equal to the minimum amount.",
        path: ["maxAmount"],
      });
    }
  });

export const OfferUpdateSchema = z
  .object({
    price: finiteNumber("Price").optional(),
    minAmount: finiteNumber("Minimum amount").optional(),
    maxAmount: finiteNumber("Maximum amount").optional(),
    paymentMethods: z
      .array(
        z
          .string()
          .min(1, "Payment method is required.")
          .max(PAYMENT_METHOD_MAX_LENGTH, "Payment method is too long."),
      )
      .max(PAYMENT_METHOD_MAX_COUNT, `Use up to ${PAYMENT_METHOD_MAX_COUNT} payment methods.`)
      .optional(),
    requirements: z.string().max(REQUIREMENTS_MAX_LENGTH, "Requirements are too long.").optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.minAmount !== undefined && data.maxAmount !== undefined && data.maxAmount < data.minAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maximum amount must be greater than or equal to the minimum amount.",
        path: ["maxAmount"],
      });
    }
  });

export const ChatMessageSchema = z
  .string()
  .min(1, "Message is required.")
  .max(CHAT_MESSAGE_MAX_LENGTH, "Message is too long.");

export type DealRequestInput = z.infer<typeof DealRequestSchema>;
export type OfferFormInput = z.infer<typeof OfferFormSchema>;
export type OfferUpdateInput = z.infer<typeof OfferUpdateSchema>;
