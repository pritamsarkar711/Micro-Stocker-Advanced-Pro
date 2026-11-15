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
