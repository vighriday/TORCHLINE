# Final design and asset provenance

The owner-provided **Figma v2** export is TORCHLINE's visual source. Its raw local folder is ignored and untouched. [Source checksums](../docs/design/source-checksums.txt) identify `App.tsx`, `Ark3D.tsx`, `VoxelScene.tsx` and `index.css`. Typed adaptations preserve its screens and 3D artwork while replacing prototype state with the actual application.

- The shared Ark, cockpit, procedural backgrounds and voxel scene originate in the export. The floating blue bridge plane is removed at the owner's request.
- The car-soccer and souls-style LIVEWIRE scenes ([`RocketScene.tsx`](../apps/web/src/final/RocketScene.tsx), [`SoulsScene.tsx`](../apps/web/src/final/SoulsScene.tsx)) were supplied by the owner on 1 November 2026 as Figma-generated scene files and adapted in-repo, with shared building blocks in [`feedKit.tsx`](../apps/web/src/final/feedKit.tsx). The source checksums above cover only the original export.
- The Judge Arena relay rehearsal, inheritance dossier, Chronicle lineage, public Chronicle, *What if?* and *Verify this record* surfaces are in-repo code written in the export's visual style; they are not part of the supplied export.
- The favicon is supplied with the export.
- Barlow Condensed and IBM Plex Mono are self-hosted from the official [Google Fonts source](https://github.com/google/fonts), with their SIL Open Font License files beside the fonts. No font CDN or external texture is used at runtime.
- React Three Fiber, Drei and Three.js retain their upstream package licenses. Figma editor/deployment plugins are not shipped.
- Public media must be captured from the integrated build after the bridge correction, with saved practice labeled honestly. Private links/session material and simulated native-provider claims are excluded. [README media](readme/README.md) lists each capture and how it was made.

TORCHLINE's practice scenes are original illustrations and never read game data.

[ADR 0033](../docs/decisions/0033-figma-v2-presentation.md) records compatibility, rendering and authority decisions. Previous artwork is recoverable from the separate archive tag; it is not the final visual source.
