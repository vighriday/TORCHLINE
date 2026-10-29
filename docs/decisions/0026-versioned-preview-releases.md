# 0026 — One app version and explicit preview source releases

Accepted October 29, 2026 after the owner requested GitHub tags, versioning and repository metadata.

Use a single version across all seven private manifests, annotated `vVERSION` tags, version-specific tracked notes, a README version link and CI alignment checks. The initial `0.1.0-preview.1` is explicitly a prerelease. The previous `0.1.0` manifest value had no published tag or release; this corrects an unreleased label rather than renaming a published release. Publish only after exact-source CI passes. Keep default-branch changes, deployment, package publishing and signing outside this operation.

Independent package versions and a release-management dependency are the strongest alternatives. All packages ship together in the current application; separate versions and new automation would add coordination without a real independently consumed package. A source release needs no new privileged Actions workflow. Existing CI remains read-only; the authenticated operator publishes the reviewed tag/notes.

| Component | Review |
| --- | --- |
| C1 Identity | No OAuth keys, consent scopes or role changes; repo metadata is maintained through existing authenticated GitHub access |
| C2 Twitch | Release label is not proof of live delivery; provider acceptance stays separately dated |
| C3 Participation | No parser, reward, admission or chat authority changes |
| C4 Engine | App SemVer is independent of immutable authored rules and replay versions |
| C5 Episodes | No timing, pause or persisted-episode changes |
| C6 Custody | Prerelease notes explicitly leave native handoff acceptance open |
| C7 Database/work | No migration, queue or saved-state mutation; SQL schema versions remain independent |
| C8 Projection | No public endpoint/header or schema change; README carries the app label |
| C9 Creator dashboard | Existing interface is unchanged; rare README features get a direct navigation link |
| C10 OBS | Source release is not native OBS acceptance; no access URL appears in archives |
| C11 History/replay | Tags identify source, not a world's revision or rules; released tags are never retargeted |
| C12 Validation | CI checks seven private manifests, README/notes alignment and the release-tag version; exact-source full Verify precedes publication |
| C13 Operations | Explicit annotated tag/prerelease, no latest-stable claim, no package/container/deployment publication; source archives exclude ignored private inputs |

References, release sequence and revisit triggers are in the [release policy](../operations/releases.md). Revisit independent versioning only when packages are actually shipped/consumed independently; revisit release automation when repeated operator work justifies a separately reviewed privileged workflow.
