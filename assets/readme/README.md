# Final-design media and proof

Only the owner-supplied Figma v2 design appears here. The bridge's floating blue panel was removed before capture. All captures use the actual integrated application and a disposable PostgreSQL simulation. They contain no live participants, private source URLs, session exports or native raid claims.

| Asset | Purpose |
| --- | --- |
| awakening.png, ark-roll.gif | Full-size final entry and actual rolling Ark footage |
| ark-roll.svg | Script-free SVG container embedding the same actual GIF; open in a compatible browser |
| mission-control.png | Actual saved chapter/challenge and captain controls |
| minecraft-livewire.png, minecraft-livewire.gif | Real saved mission dock with illustrative Minecraft scene; not game telemetry or automatic result detection |
| relay-broadcast.png | Read-only OBS view of a received Ark showing the inheritance dossier after a practice relay |
| relay-rehearsal.png | Judge Arena relay rehearsal stopped on the receiver's dossier |
| lineage.png, season-record.png | Chronicle lineage and season record for one Ark carried by three practice communities to a colony |
| season-finale.png | Read-only OBS view of the same finished voyage with its season finale card |
| proof.json, flight-log.csv | Pure-engine examples, actual resource consequences and replay-checked repair witness |

GitHub's [official documentation](https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files) says inline SVG scripting/animation is unsupported. The README therefore uses GIFs with reduced-motion PNG alternatives and clear captions. No unsupported interactive widget or remote badge service is required.

## Reproduce

Use Node 24, the pinned workspace dependencies, a built frontend, installed Playwright Chromium and an isolated development DATABASE_URL. Optional Python dependencies are in [requirements.txt](../../scripts/readme/requirements.txt).

```powershell
pnpm build
node --env-file=.env scripts/readme/capture-final.ts
python scripts/readme/encode-final.py
pnpm readme:proof
```

The capture binds only a disposable local simulation at port 3102, then drops its schema and closes the app/browser. It waits for actual rendered frames and the canvas/ancestor entrance fades to be visible; a ready GPU frame alone is insufficient. Raw frames and manifests remain ignored under .local/final-media. GIFs contain 24 actual sampled browser frames, resized without invented intermediate frames; timing is condensed for documentation. Each GIF must remain under 5 MB. Review the selected images and privacy scan before staging.

The relay images were captured from a local saved-practice server at 1920×1080 after driving the public practice endpoints as alpha, beta and gamma; every relay used labeled simulated raid evidence.

See [design provenance](../design-provenance.md) for the supplied artwork, fonts and licenses. These captures demonstrate presentation and saved practice, not genuine Twitch, native OBS or raid acceptance.
