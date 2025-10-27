import { toUserSide } from "@/lib/deal-utils";

export type DealProgressState = "NEW" | "REQUESTED" | "ACCEPTED" | "PAID" | "RELEASED" | "CANCELED";
export type DealSideValue = "BUY" | "SELL";
export type DealUserRole = "MAKER" | "TAKER";
export type DealActionType = "REQUEST" | "ACCEPT" | "CANCEL" | "MARK_PAID" | "RELEASE";

export interface ActionConfig {
  type: DealActionType;
  label: string;
  variant?: "default" | "outline";
}

export interface CommentConfig {
  label?: string;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
}

export interface ScenarioStateConfig {
  instructions: string;
  comment?: CommentConfig;
  primaryAction?: ActionConfig;
  secondaryAction?: ActionConfig;
}

type ScenarioMap = Record<DealUserRole, Record<DealSideValue, Partial<Record<DealProgressState, ScenarioStateConfig>>>>;

export const DEAL_SCENARIO_MAP: ScenarioMap = {
  MAKER: {
    BUY: {
      REQUESTED: {
        instructions:
          "Accept the taker request or cancel it. Confirming escrows a deposit equal to the trade amount. The deposit returns automatically once the deal completes or if it is canceled. WARNING: Do not send fiat before you accept the deal!",
        comment: {
          label: "Add a comment (optional)",
          placeholder: "Share payment expectations or additional details"
        },
        primaryAction: { type: "ACCEPT", label: "ACCEPT" },
        secondaryAction: { type: "CANCEL", label: "CANCEL", variant: "outline" }
      },
      ACCEPTED: {
        instructions:
          "Send the fiat transfer to the client. After you send it, mark the deal as paid. If you cannot complete the transfer you may cancel the deal.",
        comment: {
          label: "Payment note (optional)",
          placeholder: "Confirm the transfer reference or share a note"
        },
        primaryAction: { type: "MARK_PAID", label: "PAID" },
        secondaryAction: { type: "CANCEL", label: "CANCEL", variant: "outline" }
      },
      PAID: {
        instructions:
          "Wait until the client verifies the payment and releases the crypto. You will receive the trade amount and your deposit immediately after the release."
      },
      RELEASED: {
        instructions: "Deal completed successfully. The trade amount and your deposit have been credited to your wallet."
      }
    },
    SELL: {
      REQUESTED: {
        instructions:
          "Accept the taker request or cancel it. Confirming escrows the trade amount plus an equal deposit. The deposit returns automatically once the deal completes or if it is canceled.",
        comment: {
          label: "Payment details (required)",
          placeholder: "Provide the bank account or payment reference for the client",
          helperText: "Share precise fiat payment instructions before accepting.",
          required: true
        },
        primaryAction: { type: "ACCEPT", label: "ACCEPT" },
        secondaryAction: { type: "CANCEL", label: "CANCEL", variant: "outline" }
      },
      ACCEPTED: {
        instructions:
          "Wait for the client to send the fiat to your payment details. Because the client is now paying, you can no longer cancel the deal."
      },
      PAID: {
        instructions:
          "The client marked the fiat as sent. Verify the funds before you release the crypto. WARNING: Do not click release until you confirmed the fiat arrived.",
        comment: {
          label: "Confirmation note (optional)",
          placeholder: "Optionally record a reference before releasing"
        },
        primaryAction: { type: "RELEASE", label: "RELEASE" }
      },
      RELEASED: {
        instructions: "Deal completed successfully. Your deposit has been returned to your wallet."
      }
    }
  },
  TAKER: {
    BUY: {
      NEW: {
        instructions:
          "Enter the trade amount. The contract locks tokens equal to the trade amount as your collateral. The collateral returns after the deal completes or if it is canceled.",
        comment: {
          label: "Payment details (required)",
          placeholder: "Provide the merchant with the fiat payment details",
          helperText: "Include precise payment instructions so the merchant can pay you.",
          required: true
        },
        primaryAction: { type: "REQUEST", label: "REQUEST" },
        secondaryAction: { type: "CANCEL", label: "CANCEL", variant: "outline" }
      },
      REQUESTED: {
        instructions:
          "Wait for the merchant to accept your request. Until they accept, you can cancel the deal and retrieve your collateral.",
        secondaryAction: { type: "CANCEL", label: "CANCEL", variant: "outline" }
      },
      ACCEPTED: {
        instructions:
          "Send the fiat to the merchant's payment details. After you transfer, mark the deal as paid. If you cannot complete the transfer you may cancel the deal.",
        comment: {
          label: "Payment note (optional)",
          placeholder: "Add a reference or clarification for the merchant"
        },
        primaryAction: { type: "MARK_PAID", label: "PAID" },
        secondaryAction: { type: "CANCEL", label: "CANCEL", variant: "outline" }
      },
      PAID: {
        instructions:
          "Wait until the merchant confirms receipt. You will receive the trade amount and your deposit immediately after they release."
      },
      RELEASED: {
        instructions: "Deal completed successfully. The trade amount and your deposit have been credited to your wallet."
      }
    },
    SELL: {
      NEW: {
        instructions:
          "Enter the trade amount. The contract locks tokens equal to the trade amount plus the same amount as collateral. The collateral returns after the deal completes or if it is canceled.",
        comment: {
          label: "Payment details (required)",
          placeholder: "Share the fiat payment instructions for the merchant",
          helperText: "The merchant uses these details to send you fiat.",
          required: true
        },
        primaryAction: { type: "REQUEST", label: "REQUEST" },
        secondaryAction: { type: "CANCEL", label: "CANCEL", variant: "outline" }
      },
      REQUESTED: {
        instructions:
          "Wait for the merchant to accept your request. Until they accept you may cancel the deal and retrieve your deposit and trade amount.",
        secondaryAction: { type: "CANCEL", label: "CANCEL", variant: "outline" }
      },
      ACCEPTED: {
        instructions:
          "Wait for the merchant to send the fiat to your payment details. Because they are paying now, you cannot cancel the deal."
      },
      PAID: {
        instructions:
          "The merchant marked the fiat as sent. Confirm receipt and release the crypto. WARNING: Do not release until you verified the fiat reached your account.",
        comment: {
          label: "Confirmation note (optional)",
          placeholder: "Record a reference before releasing (optional)"
        },
        primaryAction: { type: "RELEASE", label: "RELEASE" }
      },
      RELEASED: {
        instructions: "Deal completed successfully. Your deposit has been returned to your wallet."
      }
    }
  }
};

export function getScenarioFromConfig(
  role: DealUserRole,
  side: DealSideValue,
  state: DealProgressState
): ScenarioStateConfig | null {
  const userSide = toUserSide(side, role);
  const roleConfig = DEAL_SCENARIO_MAP[role][userSide];
  return roleConfig[state] ?? null;
}
