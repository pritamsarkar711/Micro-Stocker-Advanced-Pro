# Micro Stocker Advanced Pro

> All-in-one **desktop workbench for microstock contributors** — metadata generation,
> per-platform CSV export, embedded IPTC/XMP writing, platform validation and
> local open-source AI upscaling to 8K. Electron + React + TypeScript.

![icon](resources/icon-256.png)

## What it does

| Module | Delivered |
| --- | --- |
| **Library** | Import EPS / AI / SVG / JPG / PNG / WebP (native picker on desktop, file chooser in preview). Existing IPTC/XMP is read on import. Vector sizes parsed from `%%BoundingBox` / `viewBox`; raster sizes probed without full decode. |
| **Metadata generation** | Offline generator: filename tokens → subject synonyms → style & category banks → ordered, de-duplicated keywords, title + description sentences. Optional BYO OpenAI-compatible endpoint (Settings → AI assistant) with automatic fallback. |
| **Per-platform adaptation** | Caps, minimums, comma-safety and keyword ordering (Adobe/Vecteezy/Getty put title words in the top 10) applied at export time per platform. |
| **CSV export** | Exact dialects: Shutterstock (header, comma, Description = title, Categories/flags), Adobe Stock (exact template, ≤5 000 rows / 1 MB, 30-char filenames), **Freepik (semicolon, single quotes, NO header, `_ai_generated` tag)**, Dreamstime, 123RF (+Country), Depositphotos (Editorial/Nudity), Vecteezy (License column, quoted keywords). Pixabay/Getty/Alamy get a copy-paste sheet (they have no CSV importer). UTF-8 + BOM. |
| **Embedded metadata** | Pure-TS XMP/IPTC writer: JPEG APP1, PNG iTXt (CRC-fixed), SVG `<metadata>`, EPS/AI PostScript header; WebP replace-only with honest limitation message. 2 KB padding for in-place edits. `.msap-backup` copies on desktop. |
| **Validation** | Per platform: formats, MP window, file-size min/max, filename charset/length, keyword min/max/special chars, title/description rules, EPS+JPG pairing, AI policy (forbidden vs disclosure), embedded-metadata reminders. |
| **Upscale studio** | Engines: built-in high-quality resampler (everywhere) + **Real-ESRGAN NCNN-Vulkan** (desktop: one-click download of the BSD-3 portable binary from GitHub, runs on your GPU, models `realesrgan-x4plus/-x2plus/-x4plus-anime/realesrnet-x4plus/realesr-animevideov3`). Scale plans chain 2/3/4× passes to hit presets incl. **8K (7680×4320)** and per-platform minimums. Custom NCNN model folder supported. |
| **Platforms reference** | 10 marketplaces with researched limits (Nov 2026), CSV dialects, vector rules, AI policies and source tags (official / community). |
| **File Doctor** | JPEG segment inspector (EXIF / **GPS** / Photoshop IRB / ICC / XMP), privacy stripping that keeps XMP + ICC, sRGB canvas re-encode with per-platform size caps (quality steps down first, resolution last), `.msap-backup` safety copies. |
| **Duplicate scanner** | 64-bit perceptual dHash clustering (≤ 8 bits = near-identical) — catches the similarity rejections Vecteezy/Adobe issue; one click selects all-but-first. |
| **Batch templates** | Title/description/keyword templates with `{name} {format} {index} {count} {category}` variables applied to selection or whole library. |
| **Watch folder** | Desktop: pick a folder and every new EPS/AI/SVG/JPG/PNG/WebP that lands in it is imported automatically (debounced, de-duplicated by path). |
| **Responsive shell** | Sidebar rail ⇄ drawer ⇄ bottom tabs, fluid type, 360 px → 4K, dark/light/system, density, 60–200 % UI scale, keyboard shortcuts, Responsive Lab device simulator. |
| **Cloud (optional)** | Supabase adapter with runtime credentials, connection tester and generated SQL (incl. offline `sync_queue`). App is fully functional offline without it. |

## Supported marketplaces

Shutterstock · Adobe Stock · Freepik (Magnific) · Pixabay · Dreamstime · 123RF ·
Depositphotos · Vecteezy · Getty Images/iStock · Alamy — plus aggregator notes
(Wirestock etc.). See **Platforms** page in-app for the full rule matrix.

## Requirements

- Node.js 20.19+ / 22.12+ (22 LTS recommended), npm 10+
- Optional: Supabase project (cloud sync), optional AI endpoint key
- Real-ESRGAN needs a Vulkan-capable GPU for speed; CPU works but is slow

## Quick start

```bash
npm install          # installs deps + Electron (~120 MB binary)
npm run dev          # Vite dev server + Electron window with hot reload
npm run dev:web      # renderer only in a browser (phone testing over LAN)
npm run verify       # type check + production build
npm run dist:win     # Windows installer -> release/  (also dist:mac / dist:linux)
```

First run of the Upscale studio with the AI engine downloads the portable
Real-ESRGAN build (~40 MB, BSD-3-Clause) into your user-data folder; after that
everything runs locally with no uploads.

## Getting real installers

Installers are 100–300 MB, so GitHub's runners build them. Copy
`docs/ci/build-desktop-installers.yml` to `.github/workflows/build.yml`
(the sandbox cannot create workflow files), then:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

The workflow publishes `.exe` / `.dmg` / `.AppImage` / `.deb` as a GitHub Release.

## Project structure

```
electron/            main process + sandboxed preload (file IO, dialogs,
                     Real-ESRGAN download/spawn, zoom, theme, single instance)
src/
  components/
    layout/          responsive shell (sidebar/topbar/tab bar/page header)
    stock/           ItemEditor drawer (metadata / platforms / embed tabs)
    ui/              design-system kit incl. responsive DataTable
  lib/stock/         domain core:
                     types, platforms (researched registry), metadata
                     generator, csv writers, validators, xmp embedder,
                     files (probing/sanitising), upscale/{classic,models,engine}
  pages/             Overview, Library, Export, Upscale, Platforms,
                     Cloud, Responsive lab, Settings, About, 404
  state/             AppProvider (settings/cloud/zoom), LibraryProvider,
                     ToastProvider
resources/           app icons (png + ico)
docs/ci/             installer workflow template
```

## Honest limitations

- PDF-based `.ai` files keep XMP in compressed streams — embed into the paired
  EPS/JPG instead (the app says so rather than corrupting the file).
- WebP without an existing XMP chunk needs a VP8X rewrite; export PNG/JPG instead.
- Real-ESRGAN runs in the desktop build only (native binary); the browser
  preview uses the built-in resampler.
- Platform limits change; values tagged `community` in-app are re-check targets.
- Releases/model/property release PDFs live in each portal — the app tracks the
  flags and reminds you.

## Licence

MIT — © 2026 pritamsarkar711. Real-ESRGAN: BSD-3-Clause (Tencent ARC Lab).
