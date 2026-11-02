# Hackathon and submission plan

Dated planning record: organizer pages checked 2026-10-26; status updated 1 November 2026. This is an engineering delivery checklist based on organizer publications, not a legal eligibility determination. The owner must verify their entry details and current organizer instructions.

## Verified requirements

As checked on 2026-10-26, the [official rules](https://twitchcon-codex.devpost.com/rules) require new work during the October 23–November 2 submission period, a functioning interactive Twitch experience built with Codex, a runnable source repository with required assets/instructions, a feature/build description, the primary Codex session ID, and a public YouTube demonstration showing Twitch functionality and Codex use. Keep the video below three minutes. Testing access must be free and available through judging. Private repositories are permitted with the specified judge access. Materials must be in English or translated. Innovation, impact, technical implementation and design are equally weighted. Entrants must check individual/team eligibility; organizations cannot enter as organizations.

## Schedule discrepancy and conservative operating plan

| Source | Published information | Planning treatment |
| --- | --- | --- |
| [Rules](https://twitchcon-codex.devpost.com/rules) | Deadline Nov 2, 2 PM Pacific; judging Nov 5–15 | Formal timing reference |
| [Schedule](https://twitchcon-codex.devpost.com/details/dates) | Deadline labeled 2 PM PST; judging Nov 3–6 | Deadline agrees with PST label; judging differs |
| [FAQ/resources](https://twitchcon-codex.devpost.com/resources) | Deadline 2 PM Pacific, but FAQ also says 21:00 UTC; judging Nov 5–15 | UTC conversion is one hour earlier than PST conversion |

November 2 at 14:00 PST converts to **November 3, 2026 at 03:30 IST** (22:00 UTC). The FAQ's 21:00 UTC statement instead converts to 02:30 IST. Do not silently choose the later time when scheduling submission. Use **November 2 at 23:59 IST** as our internal submit-by cutoff, and recheck the organizer countdown/updates before submission. If necessary, the owner can seek clarification; no external message has been sent during planning.

Plan judge availability from the earlier published judging start through **November 16 at 06:30 IST**, covering the rules' November 15 at 17:00 PST end. Freeze and identify the submitted commit; handle post-deadline changes only as permitted by organizer instructions.

## Artifact checklist

- [ ] Runnable candidate matches the claims in the description and video.
- [ ] Authentic Twitch chat and native raid evidence recorded without credentials. Genuine viewer chat → saved gameplay was observed on 30 October; a native raid is not yet verified.
- [ ] Complete solo gameplay and a non-voting puzzle contribution demonstrated.
- [x] Repository includes all application source, owned/licensed assets, environment template, setup, database migrations and test instructions.
- [x] Actual primary Codex session ID captured from the development session; no fabricated ID or raw private session export.
- [ ] Description explains product functionality and concrete Codex contributions.
- [ ] Public YouTube video below three minutes, link checked from a signed-out browser.
- [ ] Judge access configured according to the current organizer instructions, including private repo access if applicable.
- [x] Hosted project and dependency services available without payment/access barriers for judges: a disposable practice demo runs at https://torchline-demo.onrender.com ([ADR 0039](../decisions/0039-hosted-practice-demo.md)). The one-command `docker compose` saved-practice preview also needs no Twitch account or hosted service.
- [ ] Asset provenance, third-party permissions and branding checked; original private idea file absent from repository and recordings.
- [ ] Entrant/team representative and eligibility reviewed by the owner.
- [ ] Devpost entry explicitly submitted; a saved draft is not enough.
- [ ] Final URL, submitted commit/tag, video URL, session ID and confirmation stored in a sanitized submission record.

Status as of 2 November 2026: the repository is on GitHub as a private repository, pre-releases v0.1.0-preview.1 to v0.1.0-preview.3 are published there, and v0.1.0-preview.4 is being prepared. A disposable practice demo is hosted at https://torchline-demo.onrender.com ([ADR 0039](../decisions/0039-hosted-practice-demo.md)); the live configuration runs only on the owner's PC behind a temporary development tunnel when started.

## Proposed 2:55 video

| Time | Evidence and message |
| --- | --- |
| 0:00–0:15 | Establish the persistent ship and two communities: one world's decisions survive its host. |
| 0:15–0:45 | Show viewers discover a clue/solve a route and help choose a consequential action on Twitch. |
| 0:45–1:20 | Show A prepare the relay and B accept the same damaged world. Show a genuine raid only if captured; otherwise show Judge Arena step 7 with its on-screen simulated-evidence label and say a live raid is not yet verified. |
| 1:20–1:50 | B faces and acts on the inherited consequence; show cause attribution and preserved resources. |
| 1:50–2:10 | Show lineage and the wider five-chapter season; explain solo play, persistence and optional handoffs. |
| 2:10–2:30 | Show quick onboarding, private controls, pause/recovery and readable OBS output. |
| 2:30–2:48 | Show actual Codex development and relevant implementation/test evidence. |
| 2:48–2:55 | End on the world and the contributing communities. |

Record genuine evidence as gates pass; the final edit can compress waiting time without implying an unobserved transfer or pretending a simulator event came from Twitch. Describe only shipped features. Do not promise a functioning creator network, perfect anti-bot protection, market-first originality or performance that has not been measured.

Guardrail: no third-party game names, logos or footage on screen in the video (blur preset labels).
