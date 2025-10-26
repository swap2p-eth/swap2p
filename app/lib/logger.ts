const DEBUG_ENABLED = process.env.NEXT_PUBLIC_SWAP2P_DEBUG === "1";

type LogPayload = unknown;

const formatScope = (scope: string) => `[swap2p:${scope}]`;

export function debug(scope: string, payload: LogPayload) {
  if (!DEBUG_ENABLED) return;
  console.debug(formatScope(scope), payload);
}

export function warn(scope: string, payload: LogPayload) {
  console.warn(formatScope(scope), payload);
}

export function error(scope: string, payload: LogPayload) {
  console.error(formatScope(scope), payload);
}
