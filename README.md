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

await host.navigate({ path: "/dashboards", newTab: false });
```

- `host.executeCommand` requires `host.executeCommand`.
- `host.navigate` requires `host.navigate`.
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
