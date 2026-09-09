# PiPhi Widget SDK

`piphi-network-widget-sdk` is the browser-safe TypeScript SDK for building sandboxed PiPhi dashboard widgets.

The SDK provides the versioned host protocol, portable widget and binding types, a typed client, lifecycle subscriptions, device state reads, permission-aware commands, navigation, settings, and responsive height reporting. Device integrations and server runtimes remain in PiPhi's Python Runtime SDK.

## Start a widget

```bash
npx --package piphi-network-widget-sdk piphi-widget create kitchen-climate --template data
cd kitchen-climate
npm install
npm run dev
```

The scaffold includes a declarative manifest, settings, English/Spanish/Arabic
catalogs, RTL-safe reference runtime, light/dark previews, and a contract test.
The local simulator provides loading/live/stale/offline/reconnecting/denied/error
fixtures, command success/rejection/timeout behavior, explicit permission
diagnostics, desktop/tablet/phone resize, light/dark themes, locale/RTL switching,
dynamic height, reconnect controls, logs, and hot reload. Choose a `data`,
`control`, `chart`, `camera`, or `multi-device` template. Run
`piphi-widget conformance` before publishing; `piphi-widget pack` runs the same
compatibility, WCAG metadata, sandbox/CSP, asset, test, and public-import gate,
computes entry integrity, and produces the artifact.

For installed widgets that only need native text, metric, status, and progress
views, import `validateDeclarativeWidgetRecipe` from
`piphi-network-widget-sdk/declarative`. Core renders these versioned recipes
without widget JavaScript, HTML, CSS, URLs, or runtime permissions. Use the
sandboxed bundle runtime for custom interaction, media, or command controls.

### Semantic components and stacked devices

Declarative metrics, statuses, and progress components can declare a smart-home
`domain`. Core uses the domain to provide consistent, accessible presentation
for temperature, humidity, air quality, energy, power, battery, lights,
switches, locks, doors, motion, and connectivity. Metric components may also
choose `normal`, `hero`, or `compact` emphasis without supplying CSS.

Use a one-level `group` to build a stacked experience for a device with more
than one job—for example, a controllable light with energy readings:

```ts
const recipe = {
  schema_version: "1",
  layout: "stack",
  items: [
    {
      type: "group",
      id: "lighting",
      label: "Light",
      items: [
        { type: "status", slot_id: "power_state", domain: "light" },
      ],
    },
    {
      type: "group",
      id: "energy",
      label: "Energy use",
      layout: "grid",
      columns: 2,
      items: [
        { type: "metric", slot_id: "power", domain: "power", emphasis: "hero" },
        { type: "progress", slot_id: "daily_energy", domain: "energy", maximum: 10 },
      ],
    },
  ],
} as const;
```

Groups cannot nest, contain executable behavior, or exceed the documented item
limits. When the native component set cannot express the experience, switch to
`sandboxed_bundle`; do not approximate an unsupported control with misleading
declarative metadata. This is the supported custom-component escape hatch.

Sandboxed widgets can opt into the same framework-neutral visual foundation:

```ts
import "piphi-network-widget-sdk/experience-kit.css";
```

Use `.piphi-stack`, `.piphi-grid`, `.piphi-group`, `.piphi-reading`,
`.piphi-status`, and `.piphi-control` with `data-piphi-domain` and
`data-emphasis` attributes. Package-owned theme stylesheets may override only
the documented `--piphi-widget-*` tokens inside the widget iframe. They cannot
change the Core card shell, dashboard grid, resize behavior, status overlay, or
other widgets. This gives developers room for a recognizable visual identity
without breaking dashboard consistency.

Declare up to eight named themes in a sandboxed widget package. Core shows these
names in the card customization drawer, persists the choice per card, and loads
only the selected integrity-pinned stylesheet:

```json
{
  "themes": [
    { "id": "calm", "name": "Calm", "stylesheet": "themes/calm.css", "color_scheme": "light" },
    { "id": "midnight", "name": "Midnight", "stylesheet": "themes/midnight.css", "color_scheme": "dark" }
  ],
  "default_theme_id": "calm"
}
```

The bootstrap `host.experienceTheme` identifies the active package theme and
`host.tokens` supplies Core's safe design tokens. The same values are exposed as
`--piphi-widget-*` CSS variables. If an update removes a saved theme, Core falls
back to the package default and then the first available theme.

Core keeps `--piphi-widget-text` readable against the active card surface and
uses it as the sandbox's inherited foreground. Experience Kit components inherit
that protected foreground automatically. A package may still use explicit text
colors for domain-specific meaning, but its light/dark conformance tests must
maintain at least WCAG 4.5:1 contrast for normal text; explicit low-contrast
colors are a package defect and must not be used as decorative theming.

Declarative experiences may use the same `themes` contract. Their stylesheets
are treated as token sheets rather than arbitrary CSS: use one `:root` rule
containing only Core's documented `--piphi-experience-*` properties. Core
extracts those tokens and retains ownership of markup, responsive layout,
focus treatment, and readable text. Package selectors, URLs, imports, and
arbitrary properties fail closed. Declarative metric, status, and progress
items may also declare a non-mutating `action` of `details` or `refresh`; Core
executes it with native keyboard and assistive-technology behavior.

## Install

```bash
npm install piphi-network-widget-sdk
```

## Use the injected host

PiPhi injects the host before loading the widget entry bundle:

```ts
import { getInjectedPiPhiWidgetHost } from "piphi-network-widget-sdk";

const host = getInjectedPiPhiWidgetHost();
const context = await host.getContext();
const title = await host.translate("widget.title");
const settings = await host.getSettings();
const state = await host.getCapabilityState({ forceRefresh: true });

// Package-native widgets can discover every named source and scope host calls
// to one saved slot. Use the returned instance ID for repeated slots.
const { bindings } = await host.getBindings();
const solar = bindings.find((slot) => slot.role === "solar");
const solarState = solar
  ? await host.getCapabilityState({ slotId: solar.id })
  : null;

await host.ready({ height: 240 });
```

Subscribe to an immediate snapshot followed by live telemetry points and connection status changes:

```ts
const unsubscribeState = await host.subscribeState(
  { capabilityIds: ["temperature", "humidity"] },
  (event) => {
    if (event.kind === "snapshot") renderSnapshot(event.data);
    if (event.kind === "point") renderPoint(event.data);
    if (event.kind === "status") showConnectionState(event.status);
    if (event.kind === "error") showError(event.error?.message);
  },
);

// Clean up when the widget unmounts.
await unsubscribeState();
```

Each package binding slot can declare how it expects data to arrive:

```json
{
  "id": "temperature",
  "data_delivery": {
    "mode": "stream_preferred",
    "stale_after_seconds": 120
  }
}
```

Use `snapshot` for values that only need an initial read, `stream_preferred` for
the normal smart-home experience with graceful snapshot fallback, and
`stream_required` only when the widget cannot work without live updates. Core
evaluates freshness from observed timestamps; the widget should not invent its
own timer or label. `host.getBindings()` and bootstrap bindings expose the
resolved policy as camel-cased `dataDelivery`.

Core consolidates delivery health at the card level. Do not repeat generic
“live,” “old,” or “offline” copy beneath every value. Sandboxed widgets receive
the detailed snapshot and stream events for domain-specific presentation, while
Core supplies a compact attention indicator when the stream reconnects or
fails. Declarative `show_freshness` fields opt readings into one shared status
line instead of creating one label per reading.

Subscribe to new bootstrap context when the theme, binding, settings, or host context changes:

```ts
const unsubscribe = host.subscribe((bootstrap) => {
  document.documentElement.dataset.theme = bootstrap.host?.theme ?? "light";
});
```

## Commands and navigation

These calls require the corresponding permission in the integration widget manifest:

```ts
await host.executeCommand({
  commandName: "turn_on",
  args: { brightness: 80 },
});

const cameraSession = await host.openCameraSession({
  type: "offer",
  sdp: browserOffer.sdp,
  includeAudio: false,
});
await peerConnection.setRemoteDescription({ type: "answer", sdp: cameraSession.sdp });
await host.closeCameraSession(cameraSession.sessionId);

await host.navigate({ path: "/dashboards", newTab: false });
```

- `host.executeCommand` requires `host.executeCommand`.
- `host.navigate` requires `host.navigate`.
- `host.openCameraSession` and `host.closeCameraSession` require `camera` and
  are scoped entirely to the saved camera binding.
- Context, settings, binding, and state reads do not require an extra host permission.
- Browser capabilities such as camera and microphone are separately controlled by the iframe policy.

## Direct protocol client

Most widgets should use the injected host. A framework adapter or test harness can create its own bridge client:

```ts
import { createPiPhiWidgetClient } from "piphi-network-widget-sdk";

const client = createPiPhiWidgetClient();
await client.ready();

// Clean up when the widget unmounts.
client.destroy();
```

## Package boundaries

- `piphi-network-widget-sdk`: browser widget API and protocol types.
- PiPhi Runtime SDK: integration lifecycle, capabilities, commands, telemetry, and widget manifest helpers.
- PiPhi Network Core: trusted host implementation, permission enforcement, iframe isolation, and dashboard rendering.

The host protocol is versioned independently from the npm package. Package `0.x` can evolve while remaining compatible with host protocol v1.

## Development

```bash
npm install
npm run check
npm test
npm run widget:conformance
npm run build
```

Pull requests and pushes to `main` run the package against Node 22.14 and Node 24. Version tags publish through npm trusted publishing and create a matching GitHub Release. See [RELEASING.md](./RELEASING.md) for the required one-time npm configuration and release procedure.
