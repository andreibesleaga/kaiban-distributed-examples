# Security policy

This repository holds example code that runs on the published `kaiban-distributed` package. Security
reports are handled in the core repository: see its policy at
<https://github.com/andreibesleaga/kaiban-distributed/security/policy> and report privately there.

The compose files bind Redis to `127.0.0.1` and set no password. They are for local use; see
`DEPLOYMENT.md` before exposing Redis on a network.

The gateway is published on `:3000` on all interfaces and starts without authentication; Kafka (when used) is
published on `127.0.0.1:9092` only. Set `A2A_JWT_SECRET`, `BOARD_JWT_SECRET`, `SOCKET_CORS_ORIGINS` and
`NODE_ENV=production` before exposing the gateway: see "Before exposing the gateway" in `DEPLOYMENT.md`.

## Dependency floors

npm `overrides` in the published `kaiban-distributed` package do not reach projects that install it,
so `package.json` here repeats the core repository's security floors (the runtime ones; the core's
build-only entries are left out). The advisories that remain are the ones the core policy lists
under "Residual advisories", with the same reasons: `zod` 3.x through `kaibanjs`, and `glob`,
`minimatch` and `deepmerge`, whose fixes need a major version.
