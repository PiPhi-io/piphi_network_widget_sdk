# Reference widgets

The CLI ships five independently conformant reference-widget templates. Each one imports only the public `piphi-network-widget-sdk` host contract and includes a manifest, localization (including RTL), previews, tests, responsive defaults, and all lifecycle states.

```sh
piphi-widget create live-value --template data
piphi-widget create light-control --template control
piphi-widget create energy-chart --template chart
piphi-widget create front-camera --template camera
piphi-widget create room-summary --template multi-device
```

`npm run widget:conformance` generates all five references in an isolated directory, builds them, and executes the same accessibility, compatibility, asset, sandbox/CSP, and private-import gate used by `piphi-widget pack`.
