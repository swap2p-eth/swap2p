const DEBUG_ENABLED = process.env.NEXT_PUBLIC_SWAP2P_DEBUG === "1";

type LogPayload = unknown;

const formatScope = (scope: string) => `[swap2p:${scope}]`;

function emit(level: "debug" | "info" | "warn" | "error", scope: string, ...payload: LogPayload[]) {
  const method = console[level] ?? console.log;
  method(formatScope(scope), ...payload);
}

export function debug(scope: string, ...payload: LogPayload[]) {
  if (!DEBUG_ENABLED) return;
  emit("debug", scope, ...payload);
}

export function info(scope: string, ...payload: LogPayload[]) {
  emit("info", scope, ...payload);
}

export function warn(scope: string, ...payload: LogPayload[]) {
  emit("warn", scope, ...payload);
}

export function error(scope: string, ...payload: LogPayload[]) {
  emit("error", scope, ...payload);
}
