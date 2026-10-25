# Dependency alerts: review and plan

Reviewed on 25 October 2026, during HackMeridian. **Decision: no dependency changes before the hackathon
submission; the fixes below are scheduled right after it.** Changing the framework version hours before a
live demo would risk more than the alerts do on a testnet beta with no real money and no personal data.

## What GitHub reports
Dependabot lists 65 open alerts on `web/`, covering 36 distinct advisories in seven packages. Advisories on
direct dependencies appear twice, once for `web/package.json` and once for `web/pnpm-lock.yaml`. The smart
contracts (`contract/`) have no alerts.

| Package | How it gets in | Alerts | Severity | Fixed in |
|---|---|---|---|---|
| `next` 14.2.35 | Direct dependency | 50 (25 advisories) | 6 critical, 18 high, 22 medium, 4 low | 15.5.x / 16 only |
| `postcss` | Direct dev dependency (8.5.6) and bundled inside Next (8.4.31) | 8 (4 advisories) | 4 high, 4 medium | 8.5.23+ |
| `postcss-selector-parser` | Through Tailwind | 1 | medium | 7.1.6 |
| `zod`, `stream-json`, `uuid`, `elliptic` | Through stellar-wallets-kit and the Stellar SDK | 6 | 1 high (zod), 4 medium, 1 low | Newer versions of those libraries |

## Exposure of this app
**Next.js.** 14.2.35 is the last release of the 14 line, which no longer receives fixes, so every Next.js
advisory is resolved only by moving to 15.5 or 16.

| Advisory group | Applies here? | Why |
|---|---|---|
| Remote code execution in the image optimizer (critical) | Possibly | `next/image` serves the four partner logos on the landing page. On Vercel, image optimization is expected to run on Vercel's own service rather than in the app's server; this has not been verified, so it is treated as exposed until the upgrade. Disabling the optimizer (`images.unoptimized`) removes it without an upgrade. |
| Remote code execution on Windows hosts (critical) | No | The app runs on Vercel's Linux runtime. |
| Server Actions: denial of service, SSRF, payload size | No | The app has no Server Actions. |
| Middleware / proxy bypass and redirect poisoning | No | The app has no middleware. |
| SSRF and request smuggling in rewrites | No | The app defines no rewrites. |
| Cache confusion and poisoning, cross-site scripting in specific setups, other denial of service | Low | No user content is rendered as HTML and no responses depend on per-user data; risk accepted until the upgrade. |

**PostCSS and the selector parser** run only when the stylesheet is compiled, on the project's own CSS.
No user input reaches them.

**zod, stream-json, uuid, elliptic** are dependencies of the wallet kit and the Stellar SDK. The app does
not pass third-party data to them directly. Forcing other versions through overrides could break wallet
connections, so they are updated together with those libraries.

## Plan after the hackathon
1. **Upgrade Next.js to 15.5 (or 16)** in a branch, with React 19: adapt page parameters and request
   APIs, check that stellar-wallets-kit works with React 19, and run the full test suite and every flow on
   testnet before merging. This closes the 50 Next.js alerts and the bundled PostCSS ones.
2. **Raise the direct PostCSS dependency** to the latest 8.5.x, and refresh Tailwind's selector parser.
3. **Update stellar-wallets-kit and the Stellar SDK** to releases that pull the fixed versions of zod,
   stream-json, uuid and elliptic.
4. **Keep Dependabot on** and review alerts before every release.

Until then, interim measure if needed: disable the image optimizer (`images: { unoptimized: true }`),
which does not change any version.
