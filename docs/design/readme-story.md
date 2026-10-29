# A README that lets people feel the game

Reviewed October 29, 2026. The owner requested a distinctive judge-facing presentation, then clarified that it must stay simple, welcoming and free of overwhelming technical detail.

## The reading experience

Lead with the shared ship and the people aboard. Let a reader make a real opening choice, then show how one viewer's repair changes an ending. Follow with actual gameplay and the unusual opportunity to rotate the game's vessel inside GitHub. Keep engineering, testing and setup available through expandable sections and links.

This supports the organizer's four equally weighted criteria—innovation, potential impact, technical implementation and design—without promising a win or claiming measured audience retention. The [organizer FAQ](https://twitchcon-codex.devpost.com/resources) says judges may rely on submitted text, images and video. The README therefore explains the experience without requiring Twitch access or a running preview. It does not replace the required submission video or primary Codex session evidence.

## Researched GitHub features

| Feature | Use and limit | Evidence |
| --- | --- | --- |
| Native expandable sections | Two opening choices and optional technical depth; no JavaScript | [GitHub collapsed sections](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections) |
| Responsive pictures | Static equivalents for a reduced-motion preference | [GitHub picture guide](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/quickstart-for-writing-on-github) |
| GIF plus original SVG artwork | Portable animation with a readable static alternative. GitHub explicitly does not support inline SVG animation or scripting; the standalone animated SVG is source material, not a promised inline effect | [GitHub non-code files](https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files) |
| Native 3D inspection | Actual vessel geometry exported to a 647,684-byte STL, below the documented 10 MB limit. Materials and transparent effects are omitted | [GitHub 3D viewer](https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files#3d-file-viewer) |
| Searchable flight recorder | A small synthetic CSV lets readers search for the repair and inspect the changed oxygen value | [GitHub CSV tables](https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files#rendering-csv-and-tsv-data) |
| Mermaid diagrams | One simple gameplay loop; engineering diagram behind a disclosure | [GitHub diagrams](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams) |
| Sanitized Markdown | Validate actual retained HTML rather than relying only on a local Markdown parser | [Markdown REST API](https://docs.github.com/en/rest/markdown/markdown), [GitHub markup pipeline](https://github.com/github/markup) |

Sources were consulted against their current official pages. GitHub's rendering service/version can differ from local previews. No arbitrary JavaScript, embedded game, autoplay video, live third-party badge service or external analytics is required.

## Why the small interactive details matter

The choices are actual ark-v3 engine results with no challenge reward or allocation. The repair comparison uses the same planned captain route; without the repair the Ark fails on chapter-five arrival, so the final choice cannot be executed. With a chapter-three scan and patch, four oxygen remain and 156 people reach a partial-survival ending. Supplies prevent a full colony. Both histories pass deterministic replay. These are authored witnesses, not success probabilities or real Twitch evidence.

The game GIF is a condensed recording of the actual React application, engine and isolated PostgreSQL save. It preserves the simulation label. The STL comes from `buildArk`, not a substitute illustration. The handoff diagram is visibly an illustration and labels native acceptance as pending. These distinctions keep the visual story inspectable.

## Boundaries and trade-offs

Assets are self-contained and repository-owned. Existing OFL fonts are outlined in SVG; attribution remains with the shipped font licenses. Original icons avoid third-party logo licensing and external image dependencies. GIFs stay below 5 MB each; the larger gameplay loop is opt-in through a disclosure. A collapsed section is not a guarantee that a browser skips downloading its image. Both animations have static sources, useful alt text and equivalent prose.

Optional Pillow/fontTools generation, Vite model capture and Playwright recording are documentation tools. They add no application dependencies and are not imported by the runtime. Regenerated JSON/CSV proof is checked for drift in CI; artwork is reviewed visually because GPU rendering is not byte-deterministic. Raw recordings/intermediate frames remain ignored. No secrets, real participant history, private concept excerpts or overlay URLs are published.

The full component review is [ADR 0025](../decisions/0025-readme-experience.md). Revisit the media if a GitHub/mobile rendering check fails, the game changes, accessibility preferences are lost or the evidence becomes stale. Permanent hosting and genuine chat/bot/OBS/raid acceptance remain separate release gates.

## Attention review — October 29

The strongest distinctive elements are the actual rotatable vessel, the captain's opening choice and the replay-checked example where one repair changes an ending. The searchable recorder adds depth after that initial hook. Artwork, GIFs and Mermaid help presentation, but their presence alone is not evidence that a README is unusual. No usage survey was performed, so rarity is an editorial assessment rather than a statistic.

The 3D artifact was hidden behind a lower disclosure. Add a direct hero-navigation link so readers can discover it immediately; retain the explanatory disclosure. Keep the other elements selective rather than adding more panels.

GitHub also supports inline ASCII-STL and GeoJSON. Putting the full 12,952-triangle Ark into a Markdown fence would substantially bloat the README source; linking the compact binary model preserves the same native inspection without that cost. An Earth-map widget does not fit the Ark's fictional route. Unsupported SVG scripting, decorative activity widgets and generated popularity badges do not improve the product story. A future before/after ship comparison should use real states and the same camera, not fabricated visual evidence.
