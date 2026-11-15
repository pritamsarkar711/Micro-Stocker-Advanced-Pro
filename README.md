<div align="center">

![Micro Stocker Advanced Pro](docs/assets/banner.png)

# Micro Stocker Advanced Pro

**The all-in-one desktop workbench for microstock contributors.**
Metadata, keywording, per-platform CSV, IPTC/XMP embedding, local AI upscaling
to 8K, validation, releases, submission planning and earnings analytics —
for **10 marketplaces**, fully offline, on Windows, macOS and Linux.

[![version](https://img.shields.io/badge/version-1.0.0-6366f1?style=for-the-badge)](https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro/releases)
[![license](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)
[![electron](https://img.shields.io/badge/Electron-45-47848F?style=for-the-badge)](https://www.electronjs.org)
[![react](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge)](https://react.dev)
[![typescript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge)](https://www.typescriptlang.org)
[![tests](https://img.shields.io/badge/tests-56%20passing-brightgreen?style=for-the-badge)](#testing)

</div>

> **Who is this for?** Regular contributors to Adobe Stock, Shutterstock,
> Freepik (Magnific) and Pixabay — and anyone else selling vectors and photos
> across several portals at once. Write your metadata **once**, then let the app
> reshape it into every platform's exact CSV dialect, embed IPTC/XMP so portals
> pre-fill their forms, and keep your releases, quotas and earnings in order.

---

## ✨ What's inside

| Module | What it does |
| --- | --- |
| **Library** | Import EPS, AI, SVG, JPG, PNG, WebP; existing IPTC/XMP is read on import. Search, filter, select, thumbnails, batch generate, batch embed, batch templates, near-duplicate scan (64-bit dHash) and folder watching (desktop). |
| **Metadata engine** | Offline generator for titles, descriptions, 7-50 keywords and categories; personal **keyword bank** (synonyms, extra category banks, EN→ES/DE/FR dictionary); optional BYO OpenAI-compatible endpoint; per-platform adaptation (title caps, comma rules, keyword order, `_ai_generated`). |
| **Export centre** | Exact CSV dialects: Shutterstock (comma + header, description-as-title), Adobe (5 000 rows / 1 MB / 30-char names), Freepik (semicolon, single quotes, **no header**), Dreamstime, 123RF, Depositphotos, Vecteezy; copy-paste sheets for Pixabay, Getty/iStock, Alamy. UTF-8 BOM, platform-safe renames, **metadata CSV import** round-trip, planner hand-off. |
| **Embedded metadata** | IPTC/XMP written into JPEG (APP1), PNG (iTXt with CRC repair), SVG `<metadata>` and EPS/AI headers with automatic `.msap-backup` copies. WebP XMP is replace-only and the app refuses to fake it. |
| **Upscale studio** | Built-in high-quality resampler **plus** one-click download of Real-ESRGAN NCNN-Vulkan (BSD-3, commercial-safe) running on your own GPU. 2/3/4× chains, presets up to 8K (7680×4320), per-platform resolution/size validation. Nothing is ever uploaded. |
| **File Doctor** | Strip camera EXIF & GPS, drop Photoshop scratch data, re-encode through sRGB at each portal's quality/size budget; **SVG sanitizer** (scripts, inline handlers, `@import`, editor namespaces) and **EPS/AI report** (Illustrator version, CMYK, live fonts, embedded rasters, `%%BoundingBox`). |
| **Submission planner** | Per-platform queues (todo → queued → submitted → accepted/rejected) with validation gating and real publishing caps — Freepik's 150-200 first-batch window and 200/month quota included. |
| **Release tracker** | Model/property release registry with expiry tracking, per-item linking, and validator warnings when commercial files show recognisable people without a release. |
| **Earnings analytics** | Import each portal's sales CSV with automatic column detection (manual remap when needed), one unified ledger, monthly trend, per-platform totals, best sellers, ledger export. 100 % local. |
| **Cloud sync** | Optional Supabase project: push/pull library descriptors (last-write-wins per item), connection health, schema SQL in-app, plus full-workspace **backup/restore** JSON. Artwork bytes never leave your machine. |
| **Responsive shell** | 360 px phones → 4K monitors: drawer nav + bottom tabs on phones, icon rail on laptops, full sidebar on desktops; dark/light themes, density, UI scale, `Ctrl+K` page search, `Ctrl ±/0` zoom, Responsive Lab that renders the live app at three widths. |

## 🌍 Supported marketplaces

| Marketplace | CSV | Keywords | AI policy | Notes enforced by the app |
| --- | --- | --- | --- | --- |
| **Shutterstock** | comma + header | 7-50 | 🚫 forbidden | Description doubles as title; 1-2 of the fixed 26 categories |
| **Adobe Stock** | comma + header | 5-49 (ordered, first 10 weighted) | ✅ labelled | ≤70-char titles without commas, ≤30-char filenames, ≤5 000 rows / 1 MB |
| **Freepik / Magnific** | semicolon, single quotes, **no header** | ≤50 | ✅ labelled | First batch 150-200 same format, 200/month, EPS + same-name JPG preview, `_ai_generated` |
| **Pixabay** | copy sheet | ≤20 tags | n/a | Portal-form workflow |
| **Dreamstime** | comma + header | 7-50 | ✅ labelled | Numeric category id, 300 DPI, UTF-8 only |
| **123RF** | comma + header | 10-50 | ✅ labelled | Country column, EPS = Illustrator 8 compatible |
| **Depositphotos** | comma + header | ≥8 | 🚫 forbidden | Editorial / Nudity flag columns |
| **Vecteezy** | comma + header | 5-50 (first 5 weighted) | ✅ labelled | `License` column (`pro`/`free`/`editorial`) |
| **Getty / iStock** | copy sheet | portal form | 🚫 forbidden | No resizing; EPS CS6 + raster pair |
| **Alamy** | copy sheet | portal form | 🚫 forbidden | ≥17 MB uncompressed, JPEG quality ≥8 |

Platform rules are researched from official contributor docs (November 2026);
values only documented by the contributor community are marked as such in-app.
The app **warns, never blocks** — you stay in control of every export.

## 🚀 Quick start

```bash
git clone https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro.git
cd Micro-Stocker-Advanced-Pro
npm install

npm run dev          # Electron window + Vite dev server
npm run dev:web      # browser-only preview (no native dialogs)
npm run verify       # typecheck + 56 runtime tests + production build
npm run dist:win     # Windows NSIS installer into ./release
```

Requirements: Node 20+ (22 recommended). The desktop build needs no server,
no account and no internet after install — apart from the optional
one-time Real-ESRGAN model download.

### Windows installer without leaving GitHub

`docs/ci/build-desktop-installers.yml` is a ready-made GitHub Actions
workflow. Copy it to `.github/workflows/build.yml`, push a `v*.*.*` tag, and
the release job builds **Windows (NSIS + portable), macOS and Linux**
artifacts and attaches them to a GitHub Release automatically.

### Optional cloud sync (Supabase)

Paste your project URL + anon key on the **Cloud connection** page, run the
shown SQL once (also stored in `src/lib/cloud/schema.ts`), and the library,
releases, planner and sales ledger sync across your machines. Without
credentials the app is a fully working offline tool.

## 🧪 Testing

```bash
npm test
```

The suite bundles the pure domain layer (CSV writers, validators, metadata
engine, XMP embedding, SVG/EPS analysis, sales parsing, planner) with esbuild
and runs **56 real assertions** on Node — including binary IPTC/XMP
round-trips through actual PNG/JPEG/SVG/EPS files and dialect round-trips of
every CSV writer. `npm run verify` chains typecheck → tests → build.

## 🗂 Project layout

```
electron/            main + preload (secure IPC: fs, dialogs, upscaler, watcher)
src/
  components/        design system (cards, tables, modals, badges…) + shell
  lib/stock/         platforms, csv, csvimport, validate, metadata, xmp,
                     files, categories, dupes, filedoctor, vectorcheck,
                     sales, submissions, sync + upscale/ (models, engine)
  state/             app, toast, library, bank, releases providers
  pages/             Overview, Library, File Doctor, Export, Upscale, Planner,
                     Releases, Earnings, Keyword bank, Platforms, Cloud,
                     Responsive lab, Settings, About
tests/               runtime smoke suite + binary fixtures
docs/                CI template, user guide, assets
```

## 🔒 Privacy by design

- Artwork bytes are processed **only on your machine**; the upscaler runs a
  local binary, the generator is offline unless you add your own endpoint.
- Cloud sync stores **descriptors** (names, metadata, statuses) — never
  pixels. Backups are plain JSON files you control.
- No analytics, no telemetry, no accounts.

##  Licence & trademarks

MIT — see [LICENSE](LICENSE). Third-party notices, including the CC0 brand
marks used for platform logos and the BSD-3 Real-ESRGAN toolchain, live in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

All marketplace names, logos and trademarks belong to their respective
owners; they appear for identification only. This project is independent and
is not affiliated with, endorsed by, or sponsored by any marketplace.

---

<div align="center">

**Made for contributors, by a contributor.**
[Bugs & ideas → Issues](https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro/issues) ·
[Releases](https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro/releases) ·
[User guide](docs/user-guide.md)

</div>
