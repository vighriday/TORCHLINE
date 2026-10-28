# Release readiness — October 28, 2026

Status: **engineering release candidate prepared; real Twitch acceptance and production deployment are not complete**. Gameplay/design are frozen. Work remains on `feat/gameplay-foundation`; no branch merge, registry publish, cloud provisioning or purchase occurred.

## Completed

- Persisted viewer/world input budgets, pending ceiling and fair multi-channel processing; dedup never consumes allowance twice. Offline notification ordering preserves previously accepted chat. Limits are validated operational guardrails, not supported-audience claims.
- Indexed/bounded history and Twitch projections; complete immutable authorized history/replay retained. Optional temporary overlay expiry preserves ordinary OBS links.
- Encrypted consistent PostgreSQL backup, separate key, authenticated pre-SQL restore, empty/different target protection, all-table fingerprints and versioned replay. Actual live scratch drill restores25 tables/25 rows/zero worlds; isolated public-schema gameplay fixture proves persistent ship-state replay.
- Strict production HTTPS/DB TLS/secret/redirect config, same-origin browser policy, bounded authenticated feeds and request timeouts. Actual subprocess kill/replacement preserves systems/resources and pauses interrupted timing once.
- Fixed Linux graceful-shutdown deadlock exposed by CI: release worker lease before ending pool. Non-root production image, private-context allowlist, production-only dependencies, source metadata and reproducible migration/start/rollback runbook. Linux CI also runs it with read-only root, dropped capabilities and no-new-privileges.
- Prepared project-only OpenSSH HTTPS alternative with pinned server fingerprint; separate ignored key, no security-protection bypass. Owner public-key registration remains necessary.
- Added all-page real-provider diagnostics, timestamp-baselined acceptance counters and an expiring public Chromium overlay probe. No script creates a world, sends chat, fabricates native proof or accepts custody. Overlay helper only adds/removes its temporary read-only grant.

## Executed automated evidence

- Final local suite: **90 tests across19 files**, production build/typecheck and **seven Chromium journeys** pass. The new pagination case and affected provider-contract suite also pass independently (11 tests). Final implementation CI is recorded below after completion.
- [Linux CI40677463127](https://github.com/vighriday/TORCHLINE/actions/runs/40677463127), commit `0a470b0`:89 tests, seven browser journeys, balance/design fixture regeneration with no drift, real image build and restricted-container migration/health/assets/authority/SIGTERM smoke all pass. Earlier `ebb2617`/`d96596a` failed the new shutdown gate; the correction is verified, not hidden by a larger timeout.
- Native PG17 encrypted restore fixture and actual local live scratch drill pass. Wrong-key/corruption/same-source/nonempty guards pass. The initial live drill found the default `public` schema collision and the regression now uses a deployment-shaped public schema.
- 50,000 synthetic ballot fixture proves indexed public query/bounded result behavior, not replay or hosted throughput. Concurrent Store/flood/fairness/refill/backlog/expiry/permission cases pass.
- `pnpm audit --prod --audit-level=high`: no known vulnerabilities returned at the October28 check. Configured-secret artifact scan passes with15 private fingerprints. Public scan remains incomplete while HTTPS is offline.
- Both local services restarted from current source against migration008 and matching browser build; simulation3000/live3001 readiness pass. No actual OBS automation action succeeded; Chromium is not OBS evidence.

## Real Twitch evidence

Read-only verification at 11:13UTC October28 minted/validated the real application token, validated one broadcaster and one bot grant with correct scopes/client/account, and inspected all provider pages: **3/3 exact enabled chat/online/offline subscriptions**. Six historical signed challenge records exist; latest October27 17:02UTC. These are actual provider/database observations, separate from fixture tests.

**Current public HTTPS is offline.** Windows Defender quarantined native ngrok as `Trojan:Win32/Kepavll!rfn`. It was not restored/exempted; no false-positive conclusion is assumed. The prepared SSH server fingerprint verifies, but account public-key authorization fails until the owner registers `.local/ngrok-ssh.pub`. Intended origin remains `https://education-slather-reps.ngrok-free.dev`.

Current live counters: **0 applied chat actions, 0 accepted native bot sends, 0 live custody transfers**. A new timestamp baseline is saved without changing gameplay. Positive public Chromium overlay verification is blocked before creating a grant. Actual visible replies, OBS CEF and genuine two-broadcaster raid/inherited-state/source-revocation are unverified. Enabled subscriptions do not override this delivery gap.

## Essential owner actions and next work

Follow the [short live checklist](../operations/live-release-checklist.md) in order: register the prepared SSH public key; confirm exact existing-app OAuth redirect; broadcaster actual chat/action/reply; private OBS source/reconnect; two consenting creators' native raid acceptance. Existing developer credentials/consents need not be recreated.

After HTTPS opens, engineering can rerun real route/secret probes, all-page subscription diagnostics, expiring public overlay verification and timestamp-baselined acceptance checks. Keep gameplay/design frozen while collecting the missing native evidence.

For a production release also approve permanent always-on hosting/region, trusted PostgreSQL TLS, remote encrypted backup retention and a staging restore. Run a measured deployed soak with queue age/latency/denial/DB/feed monitoring and edge limits. Durable rejection/dedup/history retention has not been pruned; sustained valid ingress still grows storage. One replica only until cross-instance fan-out/reconciliation is designed. Actual capacity, production RPO/RTO and judging availability are unproven. See [deployment](../operations/deployment.md), [backup runbook](../operations/backup-and-restore.md), and [authority review](../reviews/2026-10-28-release-authority.md).
