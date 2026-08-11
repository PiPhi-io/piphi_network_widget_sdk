# PiPhi Widget SDK

`@piphi/widget-sdk` is the browser-safe TypeScript SDK for building sandboxed PiPhi dashboard widgets.

The SDK provides the versioned host protocol, portable widget and binding types, a typed client, lifecycle subscriptions, device state reads, permission-aware commands, navigation, settings, and responsive height reporting. Device integrations and server runtimes remain in PiPhi's Python Runtime SDK.

## Install

```bash
npm install @piphi/widget-sdk
```

## Use the injected host

PiPhi injects the host before loading the widget entry bundle:

```ts
import { getInjectedPiPhiWidgetHost } from "@piphi/widget-sdk";

const host = getInjectedPiPhiWidgetHost();
const context = await host.getContext();
const settings = await host.getSettings();
const state = await host.getCapabilityState({ forceRefresh: true });

await host.ready({ height: 240 });
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
import { createPiPhiWidgetClient } from "@piphi/widget-sdk";

const client = createPiPhiWidgetClient();
await client.ready();

// Clean up when the widget unmounts.
client.destroy();
```

## Package boundaries

- `@piphi/widget-sdk`: browser widget API and protocol types.
- PiPhi Runtime SDK: integration lifecycle, capabilities, commands, telemetry, and widget manifest helpers.
- PiPhi Network Core: trusted host implementation, permission enforcement, iframe isolation, and dashboard rendering.

The host protocol is versioned independently from the npm package. Package `0.x` can evolve while remaining compatible with host protocol v1.

## Development

```bash
npm install
npm run check
npm test
npm run build
```
