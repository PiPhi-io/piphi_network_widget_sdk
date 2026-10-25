/** Widgets run inside Core's widget host and never own a network listener. */
export interface PiPhiWidgetRuntimeContract {
  version: 1;
  port_binding: "not_applicable";
}

export const PIPHI_WIDGET_RUNTIME_CONTRACT: Readonly<PiPhiWidgetRuntimeContract> = Object.freeze({
  version: 1,
  port_binding: "not_applicable",
});

export function isPiPhiWidgetRuntimeContract(value: unknown): value is PiPhiWidgetRuntimeContract {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 1
    && candidate.port_binding === "not_applicable"
    && Object.keys(candidate).length === 2;
}
