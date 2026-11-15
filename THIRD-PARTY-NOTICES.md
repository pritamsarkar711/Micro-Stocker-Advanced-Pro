# Third-party notices

Micro Stocker Advanced Pro is © 2026 pritamsarkar711 and is distributed under
the licence in [LICENSE](LICENSE). It bundles or derives from the components
below. Their licences continue to govern those components.

## Runtime dependencies

| Component | Licence | Use |
| --- | --- | --- |
| Electron | MIT | Desktop runtime |
| React / React DOM | MIT | UI renderer |
| React Router | MIT | Routing |
| Recharts (+ d3 packages) | MIT / ISC | Charts |
| Lucide icons | ISC | Icon set |
| Supabase JS client | Apache-2.0 | Optional cloud sync |
| Tailwind CSS | MIT | Styling |
| clsx | MIT | Class utilities |
| Vite, TypeScript, esbuild | MIT / Apache-2.0 | Build tooling (not shipped) |

## Bundled assets

| Asset | Licence | Use |
| --- | --- | --- |
| Inter (variable, latin) | SIL Open Font License 1.1 | UI body text, self-hosted in `public/fonts/` |
| Manrope (variable, latin) | SIL Open Font License 1.1 | Display/headings, self-hosted in `public/fonts/` |

Both font files are unmodified latin subsets redistributed under the OFL; the
licence text ships with the packages published on npm as
`@fontsource-variable/inter` and `@fontsource-variable/manrope`. No font is
fetched from a third-party server at runtime.

## Bundled upscaling engine (downloaded on request)

| Component | Licence | Use |
| --- | --- | --- |
| Real-ESRGAN weights (`realesrgan-x4plus`, `realesrnet-x4plus`, `realesrgan-x4plus-anime`, `realesr-animevideov3`) | BSD-3-Clause | Local GPU upscaling |
| Real-ESRGAN ncnn-vulkan binary | MIT | Runs the weights on the user's GPU, downloaded on request |

The binary is **not** redistributed with this repository. It is downloaded from
the upstream `xinntao/Real-ESRGAN` release at the user's request and run
entirely offline afterwards. Output produced with it may be sold; check each
marketplace's AI-disclosure policy separately.

Models deliberately **not** bundled: 4x-UltraSharp (CC BY-NC-SA 4.0),
SUPIR (non-commercial) and NMKD Siax (custom terms).

## Brand marks

Platform marks are drawn from **simple-icons** (CC0-1.0, public domain data)
where a mark exists, and rendered as wordmark monograms where the project does
not publish one. CC0 places no restrictions on use; the underlying trademarks
remain the property of their owners and this project claims no rights in them.

Marketplace names, logos and trademarks belong to their respective owners and
appear in this application **only to identify the portal a file is prepared
for** (nominative use). Nothing here implies affiliation, endorsement or
sponsorship by any marketplace.

## AI upscaling

| Component | Licence | Notes |
| --- | --- | --- |
| Real-ESRGAN (NCNN-Vulkan portable build) | BSD-3-Clause | Downloaded by the user on first use, runs locally, never uploaded |
| Real-ESRGAN model weights | BSD-3-Clause, © 2021 Xintao Wang | Commercial use permitted by the licence |

The application does **not** ship these binaries; it downloads them from the
official GitHub release into the user's own data folder and executes them
locally.

## Data sources

Platform rules in `src/lib/stock/platforms.ts` summarise publicly documented
contributor requirements (official help pages and public contributor guides,
2026). Values that are community-documented rather than officially published are
flagged in the app. Requirements change: always re-check a portal's own help page
before a large submission.
