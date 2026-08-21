# Releasing `piphi-network-widget-sdk`

Releases are immutable and tag-driven. The version in `package.json` is the source of truth, and the release workflow refuses to publish when its Git tag does not exactly equal `v<version>`.

## One-time npm trusted-publisher setup

Configure the package on npmjs.com with this GitHub Actions trusted publisher:

- Organization or user: `PiPhi-io`
- Repository: `piphi_network_widget_sdk`
- Workflow filename: `release.yml`
- Allowed action: `npm publish`
- Environment: leave empty

The workflow uses GitHub OIDC and does not require an `NPM_TOKEN`. It must run on a GitHub-hosted runner. After trusted publishing works, configure npm publishing access to require 2FA and disallow traditional tokens.

If the package does not yet exist on npm, an owner must bootstrap the package and its trusted-publisher configuration before the first automated release.

## Release process

1. Update `package.json` and `package-lock.json` to the intended version.
2. Update release notes or the README when behavior or compatibility changed.
3. Open and merge a pull request. CI must pass on Node 22.14 and Node 24.
4. Create and push the exact version tag, for example `v0.1.0`.
5. The `Release` workflow validates, tests, builds, and publishes the package.
6. The workflow creates a GitHub Release with generated notes after npm publication succeeds.

To retry a partially completed release, rerun the failed workflow. It detects an existing npm version and will not attempt to republish that immutable version.

## Local verification

```bash
npm ci
npm run check
npm test
npm run widget:conformance
node scripts/verify-release.mjs "v$(node -p "require('./package.json').version")"
npm pack --dry-run
```
