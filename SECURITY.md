# Security policy

This repository holds example code that runs on the published `kaiban-distributed` package. Security
reports are handled in the core repository: see its policy at
<https://github.com/andreibesleaga/kaiban-distributed/security/policy> and report privately there.

The compose files bind Redis to `127.0.0.1` and set no password. They are for local use; see
`DEPLOYMENT.md` before exposing Redis on a network.
