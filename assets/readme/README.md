# README media and proof

Only owner-supplied Figma design (the v2 export and the 1 November LIVEWIRE scene files) and in-repo surfaces built in its style appear here; see [design provenance](../design-provenance.md). The bridge's floating blue panel was removed before capture. Every image and animation was captured from the actual application in saved practice. None of it is Twitch acceptance footage: the captures contain no live participants, private source URLs, session exports or native raid claims.

## Animations

The root README embeds the animated WebP in a `<picture>` element whose `prefers-reduced-motion: reduce` source is the matching still, with descriptive alt text and a caption.

| Asset               | Shows                                                                  | Reduced-motion still |
| ------------------- | ---------------------------------------------------------------------- | -------------------- |
| hero-awakening.webp | The opening scene: ARK-001 rolling above a planet (960×540, about 5 s) | awakening.png        |

The animation was recorded from an isolated saved-practice server with GPU-accelerated headless Chromium. Frames came from a Chrome DevTools Protocol (CDP) screencast and were encoded with Chromium's own WebP encoder on a 24 fps timeline (42 ms per frame). Some frames are held for two or more ticks, so the average rate of distinct frames is about 18–21 per second. They are real browser frames, with no generated or interpolated gameplay. The relay and LIVEWIRE animations were retired on 2 November 2026; the README now shows their stills and links to the same moments in the video. The scratch capture script is not committed.

## Stills

These stills were captured before the LIVEWIRE presets were renamed on 2 November 2026, so the third-party game names they showed are blurred.

| Asset                                                          | Shows                                                                                                                                                                                                 |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| awakening.png                                                  | Full-size final entry scene (1440×900)                                                                                                                                                                |
| mission-control.png                                            | Saved chapter one: resources, the cooperative shield-relay challenge and captain controls                                                                                                             |
| voxel-livewire.png                                             | Saved LIVEWIRE mission dock with the illustrated voxel scene                                                                                                                                          |
| livewire-voxel.webp, livewire-rocket.webp, livewire-souls.webp | The three preset feeds and game-styled HUDs (1280×720): voxel lava-gap jump ("Voxel Survival" preset), car-soccer aerial goal ("Car Soccer" preset) and souls-style boss attempt ("Souls Run" preset) |
| dossier.png                                                    | Element screenshot of the inheritance dossier on a received practice Ark                                                                                                                              |
| what-if.png                                                    | Element screenshot of the _What if?_ panel for the chapter-one decision                                                                                                                               |
| verify.png                                                     | Element screenshot of a _Verify this record_ result: the saved log replayed through `ark-v3` with matching SHA-256 digests                                                                            |
| relay-broadcast.png                                            | Read-only OBS view of a received Ark showing the inheritance dossier after a practice relay                                                                                                           |
| cross-game-relay.png                                           | Judge Arena after both LIVEWIRE missions: alpha's voxel-preset failure and the receiver's car-soccer-preset repair on the same Ark                                                                    |
| lineage.png, season-record.png                                 | Chronicle lineage and season record for one Ark carried by three practice communities to a colony                                                                                                     |
| season-finale.png                                              | Read-only OBS view of the same finished voyage with its season finale card                                                                                                                            |

## Engine proof

| Asset          | Shows                                                                                                                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| proof.json     | Pure-engine examples: the same captain route with and without one viewer's repair, both first-chapter commitments, and `captainChair`, the two-level decision tree behind the README's captain's-chair section. Every journey is replay-checked |
| flight-log.csv | Command-by-command flight recorder of the viewer-repair journey                                                                                                                                                                                 |

`pnpm readme:proof` ([export-proof.ts](../../scripts/readme/export-proof.ts)) regenerates both files from the current rules; CI fails if either drifts.

## How each capture was made

- **Committed script.** [capture-final.ts](../../scripts/readme/capture-final.ts) captures awakening.png, mission-control.png and voxel-livewire.png. It binds only a disposable local simulation at port 3102, then drops its schema and closes the app and browser. It waits for actual rendered frames and for the canvas and its ancestors' entrance fades to become visible; a ready GPU frame alone is insufficient. Its raw frames and manifest stay ignored under `.local/final-media`. The optional [encode-final.py](../../scripts/readme/encode-final.py) step ([requirements](../../scripts/readme/requirements.txt)) belongs to an earlier animation pipeline and is not used for the current media.
- **Not committed.** The animated WebP, the preset stills, the dossier, _What if?_ and _Verify_ element screenshots, and the relay, cross-game, lineage and season images were captured manually or with scratch scripts that are not in the repository. The 1920×1080 relay images came from a local saved-practice server after driving the public practice endpoints as practice communities; every relay used labelled simulated raid evidence.

To regenerate the committed captures and proof, use Node 24, the pinned workspace dependencies, a built frontend, installed Playwright Chromium and an isolated development `DATABASE_URL`:

```powershell
pnpm build
node --env-file=.env scripts/readme/capture-final.ts
pnpm readme:proof
```

Review the selected images and run a privacy scan before staging.

## What these files do not show

- They are saved practice: not Twitch acceptance footage, native OBS broadcast evidence or a native raid.
- LIVEWIRE feeds are illustrations, not game telemetry or automatic result detection. Every result is streamer-attested; in the Judge Arena the attestations are scripted practice results.
- Every relay shown used labelled simulated raid proof.
