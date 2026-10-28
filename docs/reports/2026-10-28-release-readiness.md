# Release readiness — October 28, 2026

Status: **engineering release candidate prepared; real Twitch acceptance and production deployment are not complete**. Gameplay/design are frozen. Work remains on `feat/gameplay-foundation`; no branch merge, registry publish, cloud provisioning or purchase occurred.

## Completed

- Persisted viewer/world input budgets, pending ceiling and fair multi-channel processing; dedup never consumes allowance twice. Offline notification ordering preserves previously accepted chat. Limits are validated operational guardrails, not supported-audience claims.
- Indexed/bounded history and Twitch projections; complete immutable authorized history/replay retained. Optional temporary overlay expiry preserves ordinary OBS links.
- Encrypted consistent PostgreSQL backup, separate key, authenticated pre-SQL restore, empty/different target protection, all-table fingerprints and versioned replay. Actual live scratch drill restores 25 tables/25 rows/zero worlds; isolated public-schema gameplay fixture proves persistent ship-state replay.
- Strict production HTTPS/DB TLS/secret/redirect config, same-origin browser policy, bounded authenticated feeds and request timeouts. Actual subprocess kill/replacement preserves systems/resources and pauses interrupted timing once.
- Fixed Linux graceful-shutdown deadlock exposed by CI: release worker lease before ending pool. Non-root production image, private-context allowlist, production-only dependencies, source metadata and reproducible migration/start/rollback runbook. Linux CI also runs it with read-only root, dropped capabilities and no-new-privileges.
- Restored development HTTPS through project-only Windows OpenSSH after the owner registered the ignored public key. Strict server fingerprint verification remains enabled; native ngrok is still quarantined and unused.
- Added all-page real-provider diagnostics, timestamp-baselined acceptance counters and an expiring public Chromium overlay probe. These live-verification scripts create no worlds, send no chat, fabricate no native proof and accept no custody. Overlay helper only adds/removes its temporary read-only grant.

## Executed automated evidence

- Final local suite: **90 tests across 19 files**, production build/typecheck and **seven Chromium journeys** pass. The new pagination case and affected provider-contract suite also pass independently (11 tests).
- **Final implementation [`9750048` passes CI 40678887999](https://github.com/vighriday/TORCHLINE/actions/runs/40678887999):** 90 tests, seven browser journeys, build/typecheck/format/repository checks, unchanged balance/design fixtures, image build and restricted-container migration/readiness/assets/authority/graceful-SIGTERM smoke. Subsequent documentation-only evidence edits do not change this tested implementation.
- [Linux CI 40677463127](https://github.com/vighriday/TORCHLINE/actions/runs/40677463127), commit `0a470b0`: 89 tests, seven browser journeys, balance/design fixture regeneration with no drift, real image build and restricted-container migration/health/assets/authority/SIGTERM smoke all pass. Earlier `ebb2617`/`d96596a` failed the new shutdown gate; the correction is verified, not hidden by a larger timeout.
- Native PG17 encrypted restore fixture and actual local live scratch drill pass. Wrong-key/corruption/same-source/nonempty guards pass. The initial live drill found the default `public` schema collision and the regression now uses a deployment-shaped public schema.
- 50,000 synthetic ballot fixture proves indexed public query/bounded result behavior, not replay or hosted throughput. Concurrent Store/flood/fairness/refill/backlog/expiry/permission cases pass.
- `pnpm audit --prod --audit-level=high`: no known vulnerabilities returned at the October 28 check. Configured-secret artifact scan and ten selected public-response probes pass with 15 private fingerprints after SSH restoration.
- Both local services restarted from current source against migration 008 and matching browser build; simulation 3000/live 3001 readiness pass. No actual OBS automation action succeeded; Chromium is not OBS evidence.

## Real Twitch evidence

Read-only verification at 15:58 UTC October 28 minted/validated the real application token, validated one broadcaster and one bot grant with correct scopes/client/account, and inspected all provider pages: **3/3 exact enabled chat/online/offline subscriptions**. Public health/readiness, anonymous/private/simulator and unsigned webhook denials pass. Six historical signed challenge records exist; latest October 27 17:02 UTC. No fresh signed Twitch notification is inferred from GET readiness.

**Current public HTTPS is restored at `https://education-slather-reps.ngrok-free.dev`.** The owner registered the project SSH public key; the strict Windows OpenSSH tunnel authenticated and forwards only live port 3001. Windows Defender's quarantined native ngrok file was not restored/exempted. Real public Chromium cookie exchange/SSE works, exposes no private diagnostics/controls and cannot mutate as a creator. Its temporary grant was removed; ordinary grants were preserved. No live Ark exists, so gameplay rendering/native OBS remains unverified.

Current live counters remain **0 applied chat actions, 0 accepted native bot sends, 0 live custody transfers**. Actual visible replies, OBS CEF and genuine two-broadcaster raid/inherited-state/source-revocation remain unverified. The owner encountered Twitch `redirect_mismatch` at the old hostname; the current server's authorization redirect was independently verified to send the new exact callback. Saving that URL in the existing app's developer console and beginning a fresh sign-in is the next external dependency. No OAuth state or callback query was retained in documentation.

## Essential owner actions and next work

SSH registration is complete. Follow the [short live checklist](../operations/live-release-checklist.md) from step 2: save the exact existing-app OAuth redirect; broadcaster actual chat/action/reply; private OBS source/reconnect; two consenting creators' native raid acceptance. Existing developer credentials/consents need not be recreated.

Route/secret probes, all-page diagnostics and expiring public overlay verification have now run against real HTTPS. Continue timestamp-baselined checks when genuine participation arrives. Keep gameplay/design frozen while collecting missing native evidence.

For a production release also approve permanent always-on hosting/region, trusted PostgreSQL TLS, remote encrypted backup retention and a staging restore. Run a measured deployed soak with queue age/latency/denial/DB/feed monitoring and edge limits. Durable rejection/dedup/history retention has not been pruned; sustained valid ingress still grows storage. One replica only until cross-instance fan-out/reconciliation is designed. Actual capacity, production RPO/RTO and judging availability are unproven. See [deployment](../operations/deployment.md), [backup runbook](../operations/backup-and-restore.md), and [authority review](../reviews/2026-10-28-release-authority.md).
