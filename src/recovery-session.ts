export type RecoveryPhase =
  | "live"
  | "loading"
  | "stale"
  | "offline"
  | "error"
  | "waiting";

export interface RecoveryStatusCopy {
  updating: string;
  stale: string;
  offline: string;
  error: string;
  waiting: string;
}

export interface RecoveryStatusModel {
  phase: RecoveryPhase;
  message: string;
  stale: boolean;
  retry: boolean;
}

export type RecoveryEventLike = {
  kind?: string | null;
  status?: string | null;
};

export type RecoveryUnsubscribe = () => void | Promise<void>;

export type RecoveryResult =
  | { ok: true }
  | { ok: false; error: unknown };

export interface RecoverySessionOptions<ReadResult, Event extends RecoveryEventLike> {
  read: () => ReadResult | Promise<ReadResult>;
  subscribe: (
    listener: (event: Event) => void,
  ) => RecoveryUnsubscribe | Promise<RecoveryUnsubscribe>;
  onStart?: (context: RecoveryContext) => void;
  onRead?: (result: ReadResult, context: RecoveryContext) => void;
  onRecovered?: (result: ReadResult, context: RecoveryContext) => void;
  onEvent?: (event: Event) => void;
  onError?: (error: unknown, context: RecoveryContext) => void;
  onSettled?: (context: RecoveryContext) => void;
  isTerminalEvent?: (event: Event) => boolean;
}

export type RecoveryContext = Readonly<Record<string, unknown>>;

export interface RecoverySession {
  recover(context?: RecoveryContext): Promise<RecoveryResult>;
  stop(): Promise<void>;
  hasSubscription(): boolean;
}

export class RecoverySessionStoppedError extends Error {
  constructor() {
    super("The widget recovery session has stopped.");
    this.name = "RecoverySessionStoppedError";
  }
}

export function recoveryEventName(event: RecoveryEventLike | null | undefined): string {
  return String(event?.status || event?.kind || "").trim().toLowerCase();
}

/** Converts host lifecycle events into one consistent, actionable widget model. */
export function resolveRecoveryStatus(
  event: RecoveryEventLike | null | undefined,
  copy: RecoveryStatusCopy,
  hasLastKnownValues = false,
): RecoveryStatusModel {
  const phase = recoveryEventName(event);
  if (["snapshot", "point", "open", "online", "ready", "connected", "live"].includes(phase)) {
    return { phase: "live", message: "", stale: false, retry: false };
  }
  if (["loading", "connecting", "reconnecting"].includes(phase)) {
    return { phase: "loading", message: copy.updating, stale: hasLastKnownValues, retry: false };
  }
  if (phase === "stale") {
    return { phase: "stale", message: copy.stale, stale: true, retry: true };
  }
  if (phase === "offline") {
    return { phase: "offline", message: copy.offline, stale: hasLastKnownValues, retry: true };
  }
  if (["error", "closed", "denied"].includes(phase)) {
    return { phase: "error", message: copy.error, stale: hasLastKnownValues, retry: true };
  }
  return { phase: "waiting", message: copy.waiting, stale: hasLastKnownValues, retry: false };
}

const defaultTerminalEvent = (event: RecoveryEventLike): boolean =>
  ["error", "closed", "denied"].includes(recoveryEventName(event));

/** Owns a forced read and one live subscription without duplicate recovery work. */
export function createRecoverySession<
  ReadResult,
  Event extends RecoveryEventLike = RecoveryEventLike,
>(options: RecoverySessionOptions<ReadResult, Event>): RecoverySession {
  let activeRequest: Promise<RecoveryResult> | null = null;
  let unsubscribe: RecoveryUnsubscribe | null = null;
  let subscriptionGeneration = 0;
  let stopped = false;
  const isTerminalEvent = options.isTerminalEvent ?? defaultTerminalEvent;

  const stopQuietly = (stop: RecoveryUnsubscribe): void => {
    void Promise.resolve(stop()).catch(() => undefined);
  };

  async function installSubscription(): Promise<void> {
    if (stopped) throw new RecoverySessionStoppedError();
    const generation = ++subscriptionGeneration;
    const listener = (event: Event): void => {
      if (generation !== subscriptionGeneration) return;
      if (isTerminalEvent(event)) {
        subscriptionGeneration += 1;
        const stop = unsubscribe;
        unsubscribe = null;
        if (stop) stopQuietly(stop);
      }
      options.onEvent?.(event);
    };
    const stop = await options.subscribe(listener);
    if (stopped || generation !== subscriptionGeneration) {
      stopQuietly(stop);
      throw stopped
        ? new RecoverySessionStoppedError()
        : new Error("Widget subscription ended before it became ready.");
    }
    unsubscribe = stop;
  }

  function recover(context: RecoveryContext = {}): Promise<RecoveryResult> {
    if (activeRequest) return activeRequest;
    if (stopped) {
      return Promise.resolve({ ok: false, error: new RecoverySessionStoppedError() });
    }
    activeRequest = (async (): Promise<RecoveryResult> => {
      let outcome: RecoveryResult;
      try {
        options.onStart?.(context);
        if (stopped) throw new RecoverySessionStoppedError();
        const result = await options.read();
        if (stopped) throw new RecoverySessionStoppedError();
        options.onRead?.(result, context);
        if (stopped) throw new RecoverySessionStoppedError();
        if (!unsubscribe) await installSubscription();
        if (stopped) throw new RecoverySessionStoppedError();
        options.onRecovered?.(result, context);
        outcome = { ok: true };
      } catch (error: unknown) {
        outcome = { ok: false, error };
        if (!stopped) {
          try {
            options.onError?.(error, context);
          } catch (callbackError: unknown) {
            outcome = { ok: false, error: callbackError };
          }
        }
      }
      if (!stopped) {
        try {
          options.onSettled?.(context);
        } catch (callbackError: unknown) {
          outcome = { ok: false, error: callbackError };
        }
      }
      return outcome;
    })().finally(() => {
        activeRequest = null;
      });
    return activeRequest;
  }

  async function stop(): Promise<void> {
    if (stopped) return;
    stopped = true;
    subscriptionGeneration += 1;
    const stopSubscription = unsubscribe;
    unsubscribe = null;
    if (stopSubscription) await stopSubscription();
  }

  return { recover, stop, hasSubscription: () => Boolean(unsubscribe) };
}
