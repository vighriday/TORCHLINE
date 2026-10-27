# Design and font provenance

The owner supplied six Claude Design HTML surfaces and four JavaScript reference exports on 2026-10-27. Unmodified originals remain in the ignored local `frontend-design/` workspace. [SHA-256 inventory](../docs/design/source-checksums.txt) identifies the reviewed exports without distributing the export runtime, synthetic gameplay data, duplicate uploads or screenshots.

The [integration review](../docs/design/integration-review.md) records the mapping to curated TypeScript/React components. Ship geometry and schematic styling are adapted from the supplied Ark references. No external model, texture, stock image or remote script is required.

The browser serves three unmodified static font files locally. Each includes the upstream SIL Open Font License in `apps/web/public/fonts/`:

| Asset | Upstream | Style |
| --- | --- | --- |
| `tektur.ttf` | [Tektur](https://github.com/google/fonts/tree/main/ofl/tektur) | 800 normal |
| `saira.ttf` | [Saira](https://github.com/google/fonts/tree/main/ofl/saira) | 400 normal |
| `kode-mono.ttf` | [Kode Mono](https://github.com/google/fonts/tree/main/ofl/kodemono) | 400 normal |

Font binaries were obtained from official `fonts.gstatic.com` URLs resolved by Google Fonts CSS on 2026-10-27. These licenses cover the fonts only; no project-wide open-source license is implied.
