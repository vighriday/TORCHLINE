# 0030 — Spatial HUD and saved presentation controls

Accepted October 29, 2026 after the owner reported crowded screens and overlapping labels/inputs. Passing page-width checks had missed real visual collisions.

## Decision

Give the heading, captain/clock status, ship, resources, mission/decision panel and footer their own layout space. `hud-layout.css` owns these positions; `game.css` and `encounter.css` retain Claude Design's art, typography and effects. `FlightDeck` introduces ship/status containers without replacing gameplay components or handlers. The renderer's existing ResizeObserver adapts the scene to its new region. Keep cosmetic sector labels inside the ship region with reserved caption space.

The captain's page may scroll on short screens so that clues, forms and final actions remain reachable. Do not hide content to force the page into one screen. Phones/tablets put launch, account status and operator setup in document flow; variable-height authentication text cannot cover the launch action. Align the other workspaces to the top instead of vertically centering short content. OBS retains a separate, constrained read-only composition at 720p/1080p; captain breakpoints must not overwrite its padding/footer geometry.

Use explicit saved clock durations in the existing presentation contract. This is an additive optional field; older design fixtures still render. Manual/custom policies survive reload and save, and unrelated crew-setting acknowledgements cannot overwrite a timing draft. The server remains the timing authority. Make the ship view control describe an enforced simplified view; after a graphics failure, retry must actually clear the failed state and rebuild the renderer. Use the same condition-color helper for schematic and 3D status labels, with dangerous integrity taking precedence over repaired condition. Passenger capacity is 216 across resource views.

Replacing the frontend or moving gameplay into a visual prototype would discard working authority/state. Smaller fonts, blanket clipping and a longer list of absolute offsets would conceal the same underlying overlap. Forcing desktop WebGL onto narrow/reduced-motion devices would undermine the existing accessibility/performance policy. These alternatives are rejected.

## Component stress review

| Component | Effect and limit |
| --- | --- |
| C1 Identity | Existing sessions, consent and operator secret checks unchanged |
| C2 Twitch gateway | Existing chat destination and native/provider evidence boundaries retained |
| C3 Participation | Same commands/eligibility; touch controls stay reachable instead of hidden behind panels |
| C4 Engine | No new rules or renderer-driven outcomes; current-rule ending witnesses are deterministic tooling |
| C5 Episodes | Read saved policy; server persists deadlines and closes phases |
| C6 Custody | Same frozen-world/native-proof acceptance; ship identity/marks continue across hosts |
| C7 Database | No schema migration; existing clock projection gains durations |
| C8 Projection | Existing contract is additive; A11 snapshot/assignment ordering remains open |
| C9 Dashboard | Fluid regions, smaller-screen flow, bounded setup menus and readable decision forms |
| C10 OBS | Separate fixed composition; no host controls or OBS control permissions granted |
| C11 History | Existing persisted events/scars and pagination retained; workspace alignment corrected |
| C12 Validation | Visual inventory, region collisions, real hit targets, saved timing, renderer loss/retry, seven physical fixtures and current-rule ending/replay witnesses |
| C13 Operations | No new dependency or render loop; native OBS and deployment acceptance remain separately reported |

See [visual review](../reviews/2026-10-29-ui-layout-review.md). Local layout fixtures and browser motion tests do not constitute real Twitch gameplay or raid proof. The new witnesses cover all three endings with the default zero repair reserve; they do not close the exhaustive v3 cooperation-balance audit.
