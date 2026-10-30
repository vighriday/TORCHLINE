# Final design and asset provenance

The owner-provided **Figma v2** export is TORCHLINE's visual source. Its raw local folder is ignored and untouched. [Source checksums](../docs/design/source-checksums.txt) identify `App.tsx`, `Ark3D.tsx`, `VoxelScene.tsx` and `index.css`. Typed adaptations preserve its screens and 3D artwork while replacing prototype state with the actual application.

- The shared Ark, cockpit, procedural backgrounds and Minecraft-style scene originate in the export. The floating blue bridge plane is removed at the owner's request.
- The favicon is supplied with the export.
- Barlow Condensed and IBM Plex Mono are self-hosted from the official [Google Fonts source](https://github.com/google/fonts), with their SIL Open Font License files beside the fonts. No font CDN or external texture is used at runtime.
- React Three Fiber, Drei and Three.js retain their upstream package licenses. Figma editor/deployment plugins are not shipped.
- Public media must be captured from the integrated build after the bridge correction, with saved practice labeled honestly. Private links/session material and simulated native-provider claims are excluded.

[ADR 0033](../docs/decisions/0033-figma-v2-presentation.md) records compatibility, rendering and authority decisions. Previous artwork is recoverable from the separate archive tag; it is not the final visual source.
