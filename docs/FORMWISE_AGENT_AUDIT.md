# Formwise Agent source audit

This repository was compared with `Shailendra76-sk/formwise-agent` before merging changes.

## Result

`fromaaply` is already a newer, expanded implementation of the same product. The older repository does not contain source-only application modules that are missing here. Its backend and frontend capabilities are already present in `fromaaply`, with additional production functionality in this repository.

## Capabilities confirmed in `fromaaply`

- End-to-end research, document readiness, controlled browser, OTP, deterministic mapping, sensitive-field approvals, screenshots, final review, and explicit manual submission.
- Email/password authentication, refresh-token sessions, OAuth handoff, phone OTP, password reset, provider-token authentication, identity linking, and production JWT enforcement.
- Database-backed AI provider control plane, model discovery, health checks, quota/cooldown policy, and bounded failover.
- Private storage providers, encrypted credentials, signed URLs, storage failover, and ownership checks.
- Durable task runtime, worker leases, task APIs, website health checks, migrations, production validation, Docker deployment, and admin operational controls.
- Live browser control with server-authoritative AI/human gates and authenticated live-session tokens.

## Merge decision

The older repository's authentication UI and live-browser JWT propagation were checked against the target. The target already contains the production versions of both, including refresh-session handling and authenticated browser WebSocket setup. Copying the older files would regress newer target behavior and remove production controls, so no duplicate or destructive overwrite was applied.

The comparison itself is recorded here for future maintainers and should be updated if either repository changes substantially.
