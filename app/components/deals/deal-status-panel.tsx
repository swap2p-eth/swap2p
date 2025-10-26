"use client";

import * as React from "react";
import { ArrowRight, Banknote, CircleCheckBig, CircleHelp, CircleX, HandCoins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DealUserRole } from "@/lib/deal-utils";
import {
  getScenarioConfig,
  type DealProgressState,
  type DealSideValue,
  type ActionConfig
} from "@/lib/deal-scenarios";
import { TokenApprovalButton, type ApprovalMode } from "./token-approval-button";
import { DealInstructionBanner } from "./deal-instruction-banner";

interface DealStatusPanelProps {
  state: DealProgressState;
  side: DealSideValue;
  role: DealUserRole;
  detailsContent?: React.ReactNode;
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
  approvalVisible?: boolean;
  primaryDisabled?: boolean;
  primaryDisabledHint?: string;
  approvalApproved?: boolean;
  approvalApprovedLabel?: string;
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


export function DealStatusPanel(props: DealStatusPanelProps) {
  const {
    state,
    side,
    role,
    detailsContent,
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
    approvalModeStorageKey,
    approvalVisible,
    primaryDisabled,
    primaryDisabledHint,
    approvalApproved,
    approvalApprovedLabel,
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
    Boolean(
      scenario?.primaryAction &&
      (scenario.primaryAction.type === "REQUEST" || scenario.primaryAction.type === "ACCEPT") &&
      approvalVisible !== false &&
      onApproveTokens,
    );

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
                "flex h-16 w-16 items-center justify-center rounded-full transition-colors",
                isCompletedOrCurrent
                  ? cn(step.colorClass, step.haloClass)
                  : "bg-muted text-muted-foreground/60"
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
              <DealInstructionBanner
                instructions={scenario.instructions}
                highlight={Boolean(scenario.primaryAction)}
                state={state}
              />
              {detailsContent ? <div className="flex flex-col gap-4">{detailsContent}</div> : null}
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
                    maxLength={128}
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
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    {showApprovalButton ? (
                      <TokenApprovalButton
                        className="flex-shrink-0"
                        disabled={disabled || busy}
                        busy={approvalBusy}
                        onApprove={onApproveTokens}
                        approvalModeStorageKey={approvalModeStorageKey}
                        approved={approvalApproved}
                        approvedLabel={approvalApprovedLabel}
                      />
                    ) : null}
                    {scenario.primaryAction ? (
                      <Button
                        type="button"
                        onClick={() => invokeAction(scenario.primaryAction, true)}
                        disabled={disabled || busy || primaryDisabled}
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
                  {primaryDisabled && primaryDisabledHint ? (
                    <p className="text-xs text-muted-foreground">{primaryDisabledHint}</p>
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
