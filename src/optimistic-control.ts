/** Keeps a responsive control stable until the device reports its state. */
export interface OptimisticControlOptions<T> {
  initial?: T;
  confirmationMs?: number;
  equals?: (left: T, right: T) => boolean;
  onChange?: (value: T | undefined) => void;
  now?: () => number;
}

export interface OptimisticControl<T> {
  readonly value: T | undefined;
  readonly confirmed: T | undefined;
  readonly pending: boolean;
  readonly awaitingConfirmation: boolean;
  begin(next: T): void;
  accept(): void;
  reject(): void;
  observe(value: T, observedAt?: number | string | null): void;
  reset(value?: T): void;
  destroy(): void;
}

function readingTime(raw: number | string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const parsed = typeof raw === "number" ? raw : /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed < 1e12 ? parsed * 1000 : parsed;
}

/** Command acceptance is not device confirmation; observe a later reading to reconcile. */
export function createOptimisticControl<T>(options: OptimisticControlOptions<T> = {}): OptimisticControl<T> {
  let confirmed = options.initial;
  let override: { value: T; issuedAt: number; pending: boolean } | null = null;
  let lastReadingAt = 0;
  let confirmationTimer: ReturnType<typeof setTimeout> | null = null;
  const now = options.now ?? Date.now;
  const equals = options.equals ?? Object.is;
  const confirmationMs = Math.max(1, options.confirmationMs ?? 10_000);
  const visible = () => override?.value ?? confirmed;
  const notify = () => options.onChange?.(visible());
  const clearTimer = () => {
    if (confirmationTimer) clearTimeout(confirmationTimer);
    confirmationTimer = null;
  };

  return {
    get value() { return visible(); },
    get confirmed() { return confirmed; },
    get pending() { return override?.pending ?? false; },
    get awaitingConfirmation() { return override !== null && !override.pending; },
    begin(next) {
      clearTimer();
      override = { value: next, issuedAt: now(), pending: true };
      notify();
    },
    accept() {
      if (!override) return;
      override.pending = false;
      const accepted = override;
      clearTimer();
      confirmationTimer = setTimeout(() => {
        if (override !== accepted) return;
        override = null;
        confirmationTimer = null;
        notify();
      }, confirmationMs);
      notify();
    },
    reject() {
      clearTimer();
      override = null;
      notify();
    },
    observe(value, observedAt) {
      const timestamp = readingTime(observedAt);
      if (timestamp !== null && timestamp < lastReadingAt) return;
      if (timestamp === null && lastReadingAt > 0 && (!override || !equals(value, override.value))) return;
      if (timestamp !== null) lastReadingAt = timestamp;
      confirmed = value;
      if (override && (equals(value, override.value)
        || (!override.pending && timestamp !== null && timestamp >= override.issuedAt))) {
        override = null;
        clearTimer();
      }
      notify();
    },
    reset(value) {
      clearTimer();
      confirmed = value;
      override = null;
      lastReadingAt = 0;
      notify();
    },
    destroy() {
      clearTimer();
      override = null;
    },
  };
}
