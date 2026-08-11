import {
  PIPHI_WIDGET_HOST_PROTOCOL,
  PIPHI_WIDGET_HOST_VERSION,
  isPiPhiWidgetBootstrap,
  isPiPhiWidgetHostResponse,
  type PiPhiWidgetBinding,
  type PiPhiWidgetBootstrap,
  type PiPhiWidgetHostMethod,
  type PiPhiWidgetHostRequest,
  type PiPhiWidgetPermission,
} from "./protocol.js";

export interface PiPhiWidgetCapabilityStateParams {
  configId?: string;
  capabilityId?: string;
  capabilityIds?: string[];
  forceRefresh?: boolean;
  maxAgeMs?: number;
}

export interface PiPhiWidgetNavigationParams {
  path?: string;
  url?: string;
  newTab?: boolean;
}

export interface PiPhiWidgetCommandParams {
  commandName?: string;
  commandId?: string;
  capabilityId?: string;
  deviceId?: string;
  args?: Record<string, unknown>;
}

export interface PiPhiWidgetHostApi {
  getBootstrap(): PiPhiWidgetBootstrap | null;
  subscribe(callback: (bootstrap: PiPhiWidgetBootstrap) => void): () => void;
  request<T = unknown>(
    method: PiPhiWidgetHostMethod,
    params?: Record<string, unknown>,
  ): Promise<T>;
  getContext<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<T>;
  getBinding(): Promise<{ binding: PiPhiWidgetBinding | null; source?: Record<string, unknown> }>;
  getCapabilityState<T = unknown>(params?: PiPhiWidgetCapabilityStateParams): Promise<T>;
  getSettings<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<T>;
  listPermissions(): Promise<PiPhiWidgetPermission[]>;
  navigate(params: PiPhiWidgetNavigationParams): Promise<{ ok: boolean }>;
  executeCommand<T = unknown>(params: PiPhiWidgetCommandParams): Promise<T>;
  setHeight(height: number): Promise<{ ok: boolean; height: number; instanceId?: string }>;
  ready(options?: { height?: number }): Promise<{ ok: boolean; height: number; instanceId?: string }>;
}

export class PiPhiWidgetHostRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PiPhiWidgetHostRequestError";
    this.code = code;
  }
}

export interface CreatePiPhiWidgetClientOptions {
  window?: Window;
  targetOrigin?: string;
  timeoutMs?: number;
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeoutId: number;
};

export function createPiPhiWidgetClient(
  options: CreatePiPhiWidgetClientOptions = {},
): PiPhiWidgetHostApi & { destroy(): void } {
  const widgetWindow = options.window ?? globalThis.window;
  if (!widgetWindow) {
    throw new Error("The PiPhi Widget SDK requires a browser window.");
  }

  const targetOrigin = options.targetOrigin ?? "*";
  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const listeners = new Set<(bootstrap: PiPhiWidgetBootstrap) => void>();
  const pending = new Map<string, PendingRequest>();
  let bootstrap: PiPhiWidgetBootstrap | null = null;
  let sequence = 0;

  function handleMessage(event: MessageEvent): void {
    if (event.source !== widgetWindow.parent) return;

    if (isPiPhiWidgetBootstrap(event.data)) {
      bootstrap = event.data;
      for (const listener of listeners) listener(bootstrap);
      return;
    }

    if (!isPiPhiWidgetHostResponse(event.data)) return;
    const response = event.data;
    const request = pending.get(response.requestId);
    if (!request) return;
    pending.delete(response.requestId);
    widgetWindow.clearTimeout(request.timeoutId);
    if (response.success) {
      request.resolve(response.result);
    } else {
      request.reject(
        new PiPhiWidgetHostRequestError(
          response.error?.code ?? "HOST_REQUEST_FAILED",
          response.error?.message ?? "Widget host request failed.",
        ),
      );
    }
  }

  function request<T = unknown>(
    method: PiPhiWidgetHostMethod,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    sequence += 1;
    const requestId = `widget-${Date.now()}-${sequence}`;
    const payload: PiPhiWidgetHostRequest = {
      protocol: PIPHI_WIDGET_HOST_PROTOCOL,
      version: PIPHI_WIDGET_HOST_VERSION,
      type: "piphi.widget.request",
      requestId,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      const timeoutId = widgetWindow.setTimeout(() => {
        pending.delete(requestId);
        reject(
          new PiPhiWidgetHostRequestError(
            "HOST_REQUEST_TIMEOUT",
            `Widget host request timed out: ${method}`,
          ),
        );
      }, timeoutMs);
      pending.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutId,
      });
      widgetWindow.parent.postMessage(payload, targetOrigin);
    });
  }

  function destroy(): void {
    widgetWindow.removeEventListener("message", handleMessage);
    listeners.clear();
    for (const request of pending.values()) {
      widgetWindow.clearTimeout(request.timeoutId);
      request.reject(
        new PiPhiWidgetHostRequestError("HOST_CLIENT_DESTROYED", "Widget client was destroyed."),
      );
    }
    pending.clear();
  }

  widgetWindow.addEventListener("message", handleMessage);

  return {
    getBootstrap: () => bootstrap,
    subscribe(callback) {
      listeners.add(callback);
      if (bootstrap) callback(bootstrap);
      return () => listeners.delete(callback);
    },
    request,
    getContext: () => request("host.getContext"),
    getBinding: () => request("host.getBinding"),
    getCapabilityState: (params = {}) => request("host.getCapabilityState", { ...params }),
    getSettings: () => request("host.getSettings"),
    listPermissions: () => request("host.listPermissions"),
    navigate: (params) => request("host.navigate", { ...params }),
    executeCommand: (params) => request("host.executeCommand", { ...params }),
    setHeight: (height) => request("host.setHeight", { height }),
    ready: (options = {}) => request("host.ready", { ...options }),
    destroy,
  };
}

export function getInjectedPiPhiWidgetHost(widgetWindow?: Window): PiPhiWidgetHostApi {
  const resolvedWindow = widgetWindow ?? (typeof window !== "undefined" ? window : undefined);
  if (!resolvedWindow) {
    throw new Error("The PiPhi Widget SDK requires a browser window.");
  }
  const host = resolvedWindow.PiPhiWidgetHost;
  if (!host) {
    throw new Error(
      "PiPhiWidgetHost is not available. Run this widget inside a PiPhi dashboard or create a client bridge.",
    );
  }
  return host;
}

function normalizeTimeout(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return 10_000;
  return Math.max(250, Math.round(value as number));
}

declare global {
  interface Window {
    PiPhiWidgetHost?: PiPhiWidgetHostApi;
    __PIPHI_WIDGET_BOOTSTRAP__?: PiPhiWidgetBootstrap;
  }
}
