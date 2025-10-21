import type { DealSideValue, DealUserRole, DealProgressState, ScenarioStateConfig } from "@/lib/deal-scenario-config";
import { getScenarioFromConfig } from "@/lib/deal-scenario-config";

export type { DealProgressState, DealSideValue, DealUserRole, ScenarioStateConfig } from "@/lib/deal-scenario-config";
export type DealActionType = "REQUEST" | "ACCEPT" | "CANCEL" | "MARK_PAID" | "RELEASE";
export type { ActionConfig, CommentConfig } from "@/lib/deal-scenario-config";

export function getScenarioConfig(
  role: DealUserRole,
  side: DealSideValue,
  state: DealProgressState
): ScenarioStateConfig | null {
  return getScenarioFromConfig(role, side, state);
}
