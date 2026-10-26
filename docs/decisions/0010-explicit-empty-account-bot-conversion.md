# ADR 0010: Confirm empty creator accounts directly as the bot

Status: implemented, fixture-tested and used for real owner bot consent, 2026-10-26. Refines ADR 0009's recovery path; chat output/raid acceptance remain separately tracked. Coverage: D6–8, D11, D17.

## Context and decision

Repeated setup attempts showed that explaining manual disconnect still left the owner in an authorization loop. Retain separate creator/bot authority, and replace the mandatory extra disconnect step with a named confirmation after operator-initiated, freshly validated Twitch bot consent. Accounts with any world, handoff or custody history remain ineligible.

For an active empty creator, store the fresh token pair encrypted in `bot_setup_confirmations` for five minutes. Set a random, hashed, one-use confirmation capability in an HttpOnly, Secure-on-HTTPS, SameSite Strict cookie scoped to `/api/operator/bot-setup`. The browser receives only the account label and expiry. No OAuth token, operator key or confirmation capability is placed in a URL or JSON body.

The confirmation button names the account Twitch returned and explicitly ends its TORCHLINE creator access. The POST requires the existing same-origin/custom-header protections plus the browser-bound capability. It accepts no account selector. Revalidate Twitch client, identity, scopes and configured bot ID, then consume the claim and check history under the shared role/account locks. Atomically end this account's creator sessions, overlays, opt-in and queued input, and install its dedicated bot grant. Other creators/worlds are preserved. Invalidate competing pending confirmations when a bot is installed.

Cancel removes only the pending claim and leaves creator authority intact. Expiry denies confirmation immediately; live startup and the existing minute worker remove expired encrypted records. Simulation cannot approve or clean up live setup claims. A fresh account or previously disconnected empty creator still completes ordinary bot OAuth directly.

## Alternatives and consequences

Automatic conversion on callback hides an authority change and can convert the wrong Twitch login. Repeating manual-disconnect instructions has failed in actual onboarding. Keeping pending tokens in browser storage would violate the server-only credential boundary. The short-lived database claim and named confirmation add one table and three scoped routes within the approved monolith; no broker, extra app registration or broad admin session is introduced.

Conversion ends local creator authority without calling Twitch revoke on its older same-application grant, which could interfere with the newly authorized bot access. Normal explicit creator disconnect retains its best-effort provider revoke behavior. Tokens remain encrypted server-side; the exposure scanner now also fingerprints pending grants.

## Validation and revisit

Real PostgreSQL/provider-fixture tests cover one-use races, foreign/absent cookie, creator/operator credentials alone, account substitution, cross-origin input, grant revocation/identity mismatch, history created after OAuth, cancellation, expiry, simulation isolation and preservation of another broadcaster's Ark. The browser journey confirms a connected creator directly after named consent. The engine/solo/mobile/overlay journeys remain intact.

See the [component stress review](../architecture/decision-stress-review.md) for all thirteen integration boundaries. Actual bot approval, grant validation and three signed callback challenges now have live evidence. Genuine chat, visible output, OBS and native raid acceptance remain distinct gates. Review this capability before adding delegated operators or multiple bot instances.
