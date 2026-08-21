export const PIPHI_WIDGET_HOST_PROTOCOL = "piphi.widget.host" as const;
export const PIPHI_WIDGET_HOST_VERSION = "1" as const;

export type PiPhiWidgetHostMethod =
  | "host.getContext"
  | "host.getBinding"
  | "host.getCapabilityState"
  | "host.subscribeState"
  | "host.unsubscribeState"
  | "host.getSettings"
  | "host.translate"
  | "host.listPermissions"
  | "host.navigate"
  | "host.executeCommand"
  | "host.setHeight"
  | "host.ready";

export type PiPhiWidgetPermission =
  | "host.navigate"
  | "host.executeCommand"
  | "navigate"
  | "command"
  | (string & {});

export interface PiPhiWidgetBinding {
  integrationId?: string;
  configId?: string;
  deviceKey?: string;
  deviceId?: string;
  capabilityId?: string;
  commandId?: string;
  mode?: string;
  valueKind?: string;
  unit?: string;
  sourceLabel?: string;
  deviceLabel?: string;
  capabilityLabel?: string;
  [key: string]: unknown;
}

export interface PiPhiWidgetLayoutContract {
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface PiPhiWidgetPackageContext {
  id?: string;
  name?: string;
  runtime?: string;
  entry?: string;
  styles?: string[];
  framework?: string;
  integrationId?: string;
  packageId?: string;
  permissions?: PiPhiWidgetPermission[];
  bindingModes?: string[];
  valueKinds?: string[];
  capabilityRequirements?: string[];
}

export interface PiPhiWidgetHostTheme {
  theme?: "light" | "dark";
  backgroundColor?: string;
  textColor?: string;
  locale?: string;
  direction?: "ltr" | "rtl";
  timeZone?: string;
}

export interface PiPhiWidgetBootstrap {
  protocol: string;
  version: string;
  type: "piphi.widget.bootstrap";
  instanceId: string;
  settings: Record<string, unknown>;
  binding: PiPhiWidgetBinding | null;
  layout: Required<PiPhiWidgetLayoutContract>;
  package?: PiPhiWidgetPackageContext;
  host?: PiPhiWidgetHostTheme;
  source?: Record<string, unknown>;
  props?: Record<string, unknown>;
}

export interface PiPhiWidgetHostRequest<
  M extends PiPhiWidgetHostMethod = PiPhiWidgetHostMethod,
> {
  protocol: string;
  version: string;
  type: "piphi.widget.request";
  requestId: string;
  method: M;
  params?: Record<string, unknown>;
}

export interface PiPhiWidgetHostError {
  code: string;
  message: string;
}

export interface PiPhiWidgetHostResponse {
  protocol: string;
  version: string;
  type: "piphi.widget.response";
  requestId: string;
  success: boolean;
  result?: unknown;
  error?: PiPhiWidgetHostError;
}

export type PiPhiWidgetStateEventKind = "snapshot" | "point" | "status" | "error";

export interface PiPhiWidgetHostEvent<T = unknown> {
  protocol: string;
  version: string;
  type: "piphi.widget.event";
  event: "state";
  subscriptionId: string;
  payload: {
    kind: PiPhiWidgetStateEventKind;
    data?: T;
    status?: string;
    error?: { code: string; message: string };
  };
}

export const DEFAULT_WIDGET_LAYOUT_CONTRACT: Required<PiPhiWidgetLayoutContract> = {
  defaultHeight: 180,
  minHeight: 120,
  maxHeight: 1200,
};

export function normalizeWidgetSdkSettings(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

export function normalizeWidgetLayoutContract(
  value: PiPhiWidgetLayoutContract | null | undefined,
): Required<PiPhiWidgetLayoutContract> {
  const minHeight = clampHeight(
    value?.minHeight,
    DEFAULT_WIDGET_LAYOUT_CONTRACT.minHeight,
    64,
    1200,
  );
  const maxHeight = clampHeight(
    value?.maxHeight,
    DEFAULT_WIDGET_LAYOUT_CONTRACT.maxHeight,
    minHeight,
    2400,
  );
  const defaultHeight = clampHeight(
    value?.defaultHeight,
    DEFAULT_WIDGET_LAYOUT_CONTRACT.defaultHeight,
    minHeight,
    maxHeight,
  );
  return { defaultHeight, minHeight, maxHeight };
}

export function normalizeWidgetRuntimeHeight(
  value: unknown,
  contract: PiPhiWidgetLayoutContract | null | undefined,
): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const normalized = normalizeWidgetLayoutContract(contract);
  return Math.min(normalized.maxHeight, Math.max(normalized.minHeight, Math.round(numeric)));
}

export function isPiPhiWidgetBootstrap(value: unknown): value is PiPhiWidgetBootstrap {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PiPhiWidgetBootstrap>;
  return (
    candidate.type === "piphi.widget.bootstrap" &&
    candidate.protocol === PIPHI_WIDGET_HOST_PROTOCOL &&
    candidate.version === PIPHI_WIDGET_HOST_VERSION &&
    typeof candidate.instanceId === "string"
  );
}

export function isPiPhiWidgetHostResponse(value: unknown): value is PiPhiWidgetHostResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PiPhiWidgetHostResponse>;
  return (
    candidate.type === "piphi.widget.response" &&
    candidate.protocol === PIPHI_WIDGET_HOST_PROTOCOL &&
    candidate.version === PIPHI_WIDGET_HOST_VERSION &&
    typeof candidate.requestId === "string" &&
    typeof candidate.success === "boolean"
  );
}

export function isPiPhiWidgetHostEvent(value: unknown): value is PiPhiWidgetHostEvent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PiPhiWidgetHostEvent>;
  return candidate.type === "piphi.widget.event"
    && candidate.protocol === PIPHI_WIDGET_HOST_PROTOCOL
    && candidate.version === PIPHI_WIDGET_HOST_VERSION
    && candidate.event === "state"
    && typeof candidate.subscriptionId === "string"
    && Boolean(candidate.payload && typeof candidate.payload === "object");
}

function clampHeight(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  const candidate = Number.isFinite(numeric) ? Math.round(numeric) : fallback;
  return Math.min(max, Math.max(min, candidate));
}
