"use client";

import * as React from "react";
import {
  ArrowRight,
  Banknote,
  CircleCheckBig,
  CircleHelp,
  CircleX,
  HandCoins
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { TokenApprovalButton, type ApprovalMode } from "./token-approval-button";

type DealProgressState = "NEW" | "REQUESTED" | "ACCEPTED" | "PAID" | "RELEASED" | "CANCELED";
type DealSideValue = "BUY" | "SELL";
type DealUserRole = "MAKER" | "TAKER";

type DealActionType = "REQUEST" | "ACCEPT" | "CANCEL" | "MARK_PAID" | "RELEASE";

interface DealStatusPanelProps {
  state: DealProgressState;
  side: DealSideValue;
  role: DealUserRole;
  disabled?: boolean;
  busy?: boolean;
  comment?: string;
  commentName?: string;
  commentError?: string;
  onCommentChange?: (value: string) => void;
  onRequest?: (comment: string) => void;
  onAccept?: (comment: string) => void;
  onCancel?: (comment: string) => void;
  onMarkPaid?: (comment: string) => void;
  onRelease?: (comment: string) => void;
  onApproveTokens?: (mode: ApprovalMode) => void;
  approvalBusy?: boolean;
  approvalModeStorageKey?: string;
}

interface TimelineStep {
  id: Exclude<DealProgressState, "NEW" | "CANCELED">;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  colorClass: string;
  haloClass: string;
}

const TIMELINE_STEPS: TimelineStep[] = [
  {
    id: "REQUESTED",
    label: "REQUESTED",
    Icon: CircleHelp,
    colorClass: "text-orange-500",
    haloClass: "bg-orange-500/10"
  },
  {
    id: "ACCEPTED",
    label: "ACCEPTED",
    Icon: CircleCheckBig,
    colorClass: "text-sky-500",
    haloClass: "bg-sky-500/10"
  },
  {
    id: "PAID",
    label: "PAID",
    Icon: Banknote,
    colorClass: "text-purple-500",
    haloClass: "bg-purple-500/10"
  },
  {
    id: "RELEASED",
    label: "RELEASED",
    Icon: HandCoins,
    colorClass: "text-emerald-500",
    haloClass: "bg-emerald-500/10"
  }
];

const CANCELED_STEP = {
  label: "CANCELED",
  Icon: CircleX,
  colorClass: "text-red-500",
  haloClass: "bg-red-500/10"
};

interface ActionConfig {
  type: DealActionType;
  label: string;
  variant?: "default" | "outline";
}

interface CommentConfig {
  label?: string;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
}

interface ScenarioStateConfig {
  instructions: string;
  comment?: CommentConfig;
  primaryAction?: ActionConfig;
  secondaryAction?: ActionConfig;
}

type ScenarioMap = Record<
  DealUserRole,
  Record<DealSideValue, Partial<Record<DealProgressState, ScenarioStateConfig>>>
>;

const scenarioContent: ScenarioMap = {
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
          "Send the fiat transfer to the counterparty. After you send it, mark the deal as paid. If you cannot complete the transfer you may cancel the deal.",
        comment: {
          label: "Payment note (optional)",
          placeholder: "Confirm the transfer reference or share a note"
        },
        primaryAction: { type: "MARK_PAID", label: "PAID" },
        secondaryAction: { type: "CANCEL", label: "CANCEL", variant: "outline" }
      },
      PAID: {
        instructions:
          "Wait until the counterparty verifies the payment and releases the crypto. You will receive the trade amount and your deposit immediately after the release."
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

function getScenarioConfig(
  role: DealUserRole,
  side: DealSideValue,
  state: DealProgressState
): ScenarioStateConfig | null {
  const roleConfig = scenarioContent[role][side];
  return roleConfig[state] ?? null;
}

export function DealStatusPanel(props: DealStatusPanelProps) {
  const {
    state,
    side,
    role,
    disabled,
    busy,
    comment,
    commentError,
    onCommentChange,
    commentName,
    onAccept,
    onCancel,
    onMarkPaid,
    onRelease,
    onRequest,
    onApproveTokens,
    approvalBusy,
    approvalModeStorageKey
  } = props;
  const scenario = getScenarioConfig(role, side, state);

  const [internalComment, setInternalComment] = React.useState("");
  const [showCommentError, setShowCommentError] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const currentComment = comment !== undefined ? comment : internalComment;

  React.useEffect(() => {
    if (comment !== undefined) {
      setInternalComment(comment);
    }
  }, [comment]);

  React.useEffect(() => {
    if (comment === undefined) {
      setInternalComment("");
    }
    setShowCommentError(false);
  }, [state, comment]);

  const handleCommentChange = (value: string) => {
    if (comment === undefined) {
      setInternalComment(value);
    }
    onCommentChange?.(value);
    if (value.trim().length > 0) {
      setShowCommentError(false);
    }
  };

  const invokeAction = (action: ActionConfig | undefined, isPrimary: boolean) => {
    if (!action) return;

    const trimmedComment = currentComment.trim();
    const commentRequired = Boolean(scenario?.comment?.required && isPrimary);

    if (commentRequired && trimmedComment.length === 0) {
      setShowCommentError(true);
      textareaRef.current?.focus();
      return;
    }

    setShowCommentError(false);

    const payload = commentRequired ? trimmedComment : currentComment;

    switch (action.type) {
      case "ACCEPT":
        onAccept?.(payload);
        break;
      case "CANCEL":
        onCancel?.(payload);
        break;
      case "MARK_PAID":
        onMarkPaid?.(payload);
        break;
      case "RELEASE":
        onRelease?.(payload);
        break;
      case "REQUEST":
        onRequest?.(payload);
        break;
      default:
        break;
    }
  };

  const progressIndex =
    state === "NEW" ? -1 : TIMELINE_STEPS.findIndex(step => step.id === state);
  const showApprovalButton =
    scenario?.primaryAction &&
    (scenario.primaryAction.type === "REQUEST" || scenario.primaryAction.type === "ACCEPT");

  return (
    <section className="rounded-3xl bg-card/60 p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] backdrop-blur">
      {state === "CANCELED" ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full border-2 border-current",
              CANCELED_STEP.colorClass,
              CANCELED_STEP.haloClass
            )}
          >
            <CANCELED_STEP.Icon className="h-8 w-8" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">CANCELED</span>
          <p className="max-w-2xl text-sm text-muted-foreground">
            This deal was canceled. Funds were automatically returned according to the contract rules.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {TIMELINE_STEPS.map((step, index) => {
              const isCompletedOrCurrent = progressIndex >= index;
              const circleClass = cn(
                "flex h-16 w-16 items-center justify-center rounded-full border-2 transition-colors",
                isCompletedOrCurrent
                  ? cn(step.colorClass, step.haloClass, "border-current")
                  : "border-muted-foreground/30 text-muted-foreground/50"
              );
              const labelClass = cn(
                "text-xs font-semibold uppercase tracking-[0.24em]",
                isCompletedOrCurrent ? step.colorClass : "text-muted-foreground/60"
              );
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className={circleClass}>
                      <step.Icon className="h-8 w-8" />
                    </div>
                    <span className={labelClass}>{step.label}</span>
                  </div>
                  {index < TIMELINE_STEPS.length - 1 ? (
                    <ArrowRight
                      className={cn(
                        "h-5 w-5",
                        progressIndex >= index ? step.colorClass : "text-muted-foreground/40"
                      )}
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
          </div>

          {scenario ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{scenario.instructions}</p>
              {scenario.comment ? (
                <div className="flex flex-col gap-2">
                  {scenario.comment.label ? (
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
                      {scenario.comment.label}
                    </label>
                  ) : null}
                  <Textarea
                    ref={textareaRef}
                    value={currentComment}
                    onChange={event => handleCommentChange(event.target.value)}
                    placeholder={scenario.comment.placeholder}
                    name={commentName}
                    disabled={disabled || busy}
                    aria-invalid={showCommentError || Boolean(commentError)}
                  />
                  {scenario.comment.helperText ? (
                    <p className="text-xs text-muted-foreground">{scenario.comment.helperText}</p>
                  ) : null}
                  {commentError ? (
                    <p className="text-xs text-red-500">{commentError}</p>
                  ) : null}
                  {showCommentError ? (
                    <p className="text-xs text-red-500">Comment is required for this action.</p>
                  ) : null}
                </div>
              ) : null}

              {(scenario.primaryAction || scenario.secondaryAction) ? (
                <div className="mt-2 flex items-center gap-3">
                  {showApprovalButton ? (
                    <TokenApprovalButton
                      className="flex-shrink-0"
                      disabled={disabled || busy}
                      busy={approvalBusy}
                      onApprove={onApproveTokens}
                      approvalModeStorageKey={approvalModeStorageKey}
                    />
                  ) : null}
                  {scenario.primaryAction ? (
                    <Button
                      type="button"
                      onClick={() => invokeAction(scenario.primaryAction, true)}
                      disabled={disabled || busy}
                      className="rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em]"
                    >
                      {scenario.primaryAction.label}
                    </Button>
                  ) : null}
                  {scenario.secondaryAction ? (
                    <Button
                      type="button"
                      variant={scenario.secondaryAction.variant ?? "outline"}
                      onClick={() => invokeAction(scenario.secondaryAction, false)}
                      disabled={disabled || busy}
                      className={cn(
                        "ml-auto rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em]",
                        scenario.secondaryAction.variant === "outline"
                          ? "border-muted-foreground/30 text-muted-foreground hover:bg-muted/50"
                          : undefined
                      )}
                    >
                      {scenario.secondaryAction.label}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
