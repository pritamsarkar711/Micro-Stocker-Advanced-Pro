# Changelog

All notable changes to Micro Stocker Advanced Pro are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.4.0] - 2026-11-17

### Added
- **New interface built on the Telenor brand font.** The whole app — body copy,
  labels, tables, the wordmark and the numeric UI — now uses self-hosted Telenor
  WOFF2 faces (Light/Regular/Medium/Bold plus italics). Two tiny Noto subsets fill
  the only gaps in the family (`৳` and `₹`) through `unicode-range`, so currency
  text never falls back to a random system face. Type and icon sizes moved up one
  step across the board, and every icon now comes from one Material Symbols set so
  weights and optical sizes match.
- **Full-width, responsive layouts.** Removed the narrow centred columns and the
  dead space under the tool pages. Image Upscaler, Video Upscaler, Background
  Remover and Image Converter are genuine two-pane workspaces: controls on the
  left, a drop zone that fills the remaining width and height on the right, and a
  full-width model catalogue underneath. Verified at 375, 768, 1280 and 1680 px
  with no horizontal overflow on 21 routes (`scripts/qa/audit-layout.mjs`).
- **Redesigned logo.** A new monogram with the brand gradient, tuned for the
  sidebar, topbar, auth screen and window icon.
- **Admin console and RBAC.** Administrators get code generation, user tables,
  grants, expiry changes, blocking and an audit trail. Those routes (Admin
  Console, Cloud Sync) and the admin badge are hidden from ordinary accounts, and
  every admin RPC re-checks `msap_is_admin()` on the server.
- **Subscription gate for new accounts.** A workspace route requires a verified,
  unexpired entitlement or an administrator role; the activation form is part of
  the gate so a new user can unlock the studio without hunting through menus.
- **Local AI (Ollama) is a first-class provider.** Free, unlimited and offline:
  pick a local model, pull it from inside the app, and generate titles,
  descriptions and keyword sets on the machine's own GPU. Cloud providers stay
  optional and keep their own keys.
- **`scripts/qa/audit-layout.mjs`** — a repeatable layout audit that walks 21 routes at four widths,
  reports console errors and horizontal overflow, and records screenshots.

### Changed
- README and About page describe the studio without pushing users to a GitHub
  repository; the About page now links Telegram, the in-app issue reporter and
  settings instead.
- Font licence notes in `THIRD-PARTY-NOTICES.md` record the Telenor faces and the
  two Noto fallback subsets.

### Fixed
- **Email verification no longer sends users to `localhost:3000`.** Sign-up and
  password recovery only pass a redirect when the app knows its own public origin,
  and the desktop build (where a `file://` redirect can never work) verifies with
  a 6-digit code typed into the app. Expired or reused links surface a readable
  message instead of a browser error page.
- **Background licensing checks no longer eject the workspace.** A re-check used
  to unmount the whole app (losing a half-typed activation code, an upload queue
  or a mask), and a slow answer could drop an active user to the gate. The last
  confirmed answer now holds until the local countdown expires, so activated
  accounts also keep working offline; a blocked or expired account still locks on
  the next successful check.
- **The entitlement countdown re-rendered the app every second.** It now updates
  four times a minute, which removes the typing latency it caused on long forms.
- **`npm test` failed on every page.** The SSR smoke test rendered routes without
  `LicenseProvider`; the harness now mirrors the real provider stack.

## [1.2.1] - 2026-11-16

### Added
- **Installers are now built and published.** Activated
  `.github/workflows/build.yml` (from the `docs/ci` template): pushing a
  `v*.*.*` tag builds the Windows `.exe` (installer + portable), macOS `.dmg`
  and Linux `.AppImage`/`.deb` on GitHub's runners and attaches them to the
  release.

### Fixed
- **Prepare → Size cap listed duplicate options.** Six marketplaces share a
  50 MB budget and the dropdown keyed its `<option>`s by the numeric cap, so
  React warned about duplicate keys and the list could render unreliably.
  Caps are now grouped (`src/lib/stock/sizecaps.ts`) and each label names the
  portals that share it. Regression-tested.
- **The browser preview reported the wrong version.** About showed `v0.2.0`
  (the preload placeholder was `0.1.0`) because the renderer had no bridge to
  read `package.json`. Both now fall back to a single `APP_VERSION` constant
  (`src/lib/version.ts`) that a test keeps in sync with `package.json`.
- **Docs claimed installers that do not exist.** Every GitHub release
  (v1.0.0–v1.2.0) ships zero assets, so the README no longer points at a
  download that isn't there; it now says how to build locally and how to
  activate `docs/ci/build-desktop-installers.yml` to publish them. The Linux
  package description also said "10 microstock marketplaces" — it is 14.

## [1.2.0] - 2026-11-15

### Added
- **Free AI metadata, five ways to reach it.** New provider layer
  (`src/lib/stock/ai.ts`) with a single settings shape and two transports
  (OpenAI-compatible and Google Gemini):
  - **Local, no key:** Ollama (`/api/tags` model detection) and any
    OpenAI-compatible server (LM Studio, llama.cpp, vLLM).
  - **Free tiers, your own key:** OpenRouter, Google Gemini (AI Studio),
    Mistral, NVIDIA NIM, Groq, Cerebras, Together.
  - Per-provider model pickers, a creativity control, a live **Test** button
    that reports the real error (401/404/429 are translated), and a one-click
    remove. Keys stay on the machine (same local `kv` store as everything else).
- **Settings → AI metadata** panel: grouped provider picker, key/endpoint
  fields that only appear when relevant, and an at-a-glance ready state.
- AI usage is now reported honestly: the toast names the provider and, when a
  call fails, says *"AI failed — used offline instead"* with the reason
  instead of silently falling back.
- **New product mark** — an `M` cut from one stroke with a caption rule.
  Regenerated `favicon.svg`, 16–512 px PNGs, `resources/icon.ico` (7 sizes) and
  `resources/icon.png`.
- Self-hosted **Inter** (body) and **Manrope** (display), variable woff2,
  OFL 1.1, no CDN.
- Tests: 68 (was 57) — provider registry, key handling, model-JSON
  normalisation, upscale planning.

### Changed
- **Redesign on Material principles.** 8 px shape scale (cards 12 px, controls
  8 px, chips 4 px), one 1 px hairline + one soft ambient shadow for elevation,
  a single primary (`#1c64f2`), tonal surfaces, 44 px header rows and a
  consistent 12 px rhythm between cards. Icon-rail sidebar with a soft active
  pill and a 3 px indicator; sticky translucent topbar; display face on every
  heading.
- Library cards now use a 4:3 thumbnail, a hover lift and a visible selection
  ring; the toolbar is search-first with the secondary tools on one line.
- Upscale studio rebuilt around three fields (source, target, engine) — the
  20-marketplace target list collapsed to six researched presets.
- Copy trimmed again: the four page subtitles that only repeated their nav
  label are gone, and the About licence paragraph is one sentence.

### Fixed
- **AI upscale produced no output.** Two independent faults:
  1. The release zip nests everything under `realesrgan-ncnn-vulkan-<date>/`,
     so extracting straight into the engine folder left the binary where the
     runner never looked. The installer now extracts to a temp folder, flattens
     it, and fails loudly if the binary is missing.
  2. The NCNN binary resolves weights as `<model>-x<scale>`, so asking for a
     2× or 3× pass selected weights that do not exist and the process exited.
     `planScale` now emits 4× passes only and closes the remaining gap with a
     final high-quality resize; `realesrgan-x2plus` (a Python-only model that
     was never in the zip) is removed from the catalogue.
- Large outputs no longer exhaust VRAM silently: passes run with an explicit
  `-t` tile size.
- `.ai` (PDF) and header-only WebP embedding still fail with a clear message
  instead of a false success (regression-tested).
- Upscale page: the "Install" button no longer appears in the browser preview
  where the binary can never run.

### Removed
- The single-endpoint `AiAssistantConfig` / `generateWithAi` path in
  `metadata.ts` — superseded by the provider registry, and the reason a paid
  OpenAI endpoint was the only option before.
- `platformPreset` (20 near-identical upscale targets), the duplicate KPI strip
  on Overview and the "4x-UltraSharp / NMKD" hints, which are non-commercial.

## [1.1.0] - 2026-11-15

### Changed
- **Rebuilt the design system on a single primary colour.** Gradients, glossy
  overlays and glow shadows are gone; cards use 8 px radii, controls 6 px and
  badges 4 px.
- **User-facing copy cut by 62%** (1,856 → 705 words): label-repeating
  descriptions, essay hints, warning banners and the dead currency card removed.
- Navigation regrouped into Workflow / Data / System with single-word labels.
- Licence replaced by a source-available proprietary licence (see below).

### Added
- Four marketplaces: **Pond5, VectorStock, Canva Creators, Envato Elements**
  with researched limits, CSV dialects and AI policy — 14 in total.
- Official brand glyphs for 10 marketplaces via simple-icons v16 (CC0).
- `Kpi` tile component; new single-colour social banner.

### Removed
- Responsive Lab page, `StatCard`, unused exports and dead bindings
  (`tsc --noUnusedLocals` is clean).

### Fixed
- Segmented controls wrap instead of overflowing at 360 px.
- Mobile drawer capped at 80 vw; skeleton radii and toast chrome aligned with
  the new design tokens.
- Platform-count test assertions updated for the expanded registry.

### Licensing
- Versions up to and including v1.0.0 remain MIT. From v1.1.0 the project is
  source-available: use official builds personally or commercially, build from
  source for yourself, but no redistribution, rebranding or resale.

## [1.0.0] - 2026-11-15

First public release of the complete microstock contributor workbench.

### Performance
- Route-level code splitting (`React.lazy` per page) plus vendor chunking:
  first paint now ships ~487 kB raw / 155 kB gzip instead of one 942 kB
  bundle, and the charts/Supabase code only loads when those pages open.
- Build target aligned with Electron's Chromium baseline; skeleton fallback
  mirrors the page layout so navigation never flashes unstyled content.

### Added
- **Library**: import EPS/AI/SVG/JPG/PNG/WebP with automatic IPTC/XMP read,
  search, format filter, selection, thumbnails, batch generate, batch embed,
  batch metadata templates, near-duplicate scan (dHash) and folder watching
  (desktop).
- **Metadata engine**: offline generator (titles, descriptions, 7-50 keywords,
  categories), personal keyword bank with synonyms and extra category banks,
  optional BYO OpenAI-compatible endpoint, per-platform adaptation.
- **Export centre**: exact CSV dialects for Shutterstock, Adobe Stock, Freepik
  (Magnific), Dreamstime, 123RF, Depositphotos and Vecteezy; copy-paste sheets
  for Pixabay, Getty/iStock and Alamy; UTF-8 BOM; platform-safe renames;
  metadata CSV import (round-trip) with dialect detection; planner hand-off.
- **Embedded metadata**: IPTC/XMP writes for JPEG (APP1), PNG (iTXt with CRC
  repair), SVG `<metadata>` and EPS/AI headers, with `.msap-backup` files;
  WebP XMP replace-only with a clear refusal when no chunk exists.
- **Upscale studio**: built-in high-quality resampler plus one-click Real-ESRGAN
  NCNN-Vulkan (BSD-3) download and local GPU execution, 2/3/4x chains, presets
  up to 8K (7680x4320), per-platform validation targets.
- **File Doctor**: EXIF/GPS strip, sRGB re-encode with per-platform size caps,
  SVG sanitizer (scripts, handlers, @import, editor namespaces) and EPS/AI
  report (Illustrator version, CMYK, live fonts, embedded rasters).
- **Submission planner**: per-platform status queues with publishing-cap
  advisories (Freepik first batch 150-200, 200/month) and validation gating.
- **Release tracker**: model/property release registry with expiry tracking,
  per-item linking and validator warnings for unreleased people.
- **Earnings analytics**: portal sales CSV import with auto column detection,
  unified ledger, monthly trend, per-platform totals, best sellers, export.
- **Cloud**: Supabase sync of library descriptors (push/pull, last-write-wins),
  schema SQL, connection health, full-workspace backup/restore JSON.
- **Shell**: fully responsive layout (360 px phones to 4K), dark/light themes,
  density, UI scale, keyboard shortcuts, page search, Responsive Lab.

### Fixed
- Freepik CSVs now quote **every** field with single quotes as the importer
  expects (previously only fields containing the delimiter were quoted).
- SVG reports now compute their "clean" verdict from the findings instead of
  always reporting clean; the sanitizer also removes `xmlns:*` editor
  declarations and editor elements.
- EPS analysis recognises `%!PS-Adobe-3.0 EPSF-3.0` version stamps (the `%%`
  prefix is not written by Illustrator).
- CSV delimiter sniffing is quote-aware, so single-quoted semicolon sheets are
  no longer split on the commas inside their keyword field.

## [0.3.0] - 2026-11-15
- Release tracker, earnings analytics, keyword bank, vector check, submission
  planner and Supabase library sync.

## [0.2.0] - 2026-11-14
- Microstock toolkit: metadata generation, per-platform CSV, XMP embedding,
  validation rules, local AI upscaling with commercial-safe models.

## [0.1.0] - 2026-11-13
- Responsive Electron + React + TypeScript + Supabase foundation.
