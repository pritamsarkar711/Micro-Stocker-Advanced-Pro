<div align="center">

![Micro Stocker Advanced Pro](docs/assets/banner.png)

# Micro Stocker Advanced Pro

**One desktop workspace for every microstock portal.**
Metadata, keywording, exact per-platform CSV, IPTC/XMP embedding, local AI
upscaling to 8K, validation, submission tracking and earnings analytics for
**14 marketplaces**. The desktop studio runs locally; account and subscription verification require an internet connection.

[![latest](https://img.shields.io/github/v/release/pritamsarkar711/Micro-Stocker-Advanced-Pro?style=for-the-badge&label=release&color=1d4ed8)](https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro/releases)
[![platforms](https://img.shields.io/badge/marketplaces-14-1d4ed8?style=for-the-badge)](#-supported-marketplaces)
[![licence](https://img.shields.io/badge/licence-source--available-575e6b?style=for-the-badge)](LICENSE)

[Download](#-download) · [Marketplaces](#-supported-marketplaces) · [Features](#-whats-inside) · [Build](#-build-from-source) · [Support](#-support)

</div>

---

## 📥 Download

Downloads for published versions are available on the [Releases page](https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro/releases). Windows installers are unsigned unless the release notes say otherwise.

The current development branch requires an account and a configured licensing backend. It is not ready for distribution until the backend has been deployed and verified. See [licensing setup](docs/licensing-setup.md). The Windows NSIS installer allows users to select the installation directory.

**Security notice:** older cloud setup instructions exposed account hashes and workspace data to anonymous clients. See [legacy project remediation](docs/licensing-setup.md#urgent-legacy-projects). Legacy cloud sync is disabled pending a secure replacement.

## 🌍 Supported marketplaces

Each card in the app carries the portal's own mark, its current limits, its CSV
dialect and its AI policy.

| Marketplace | Bulk CSV | Keywords | AI content |
| --- | --- | --- | --- |
| **Shutterstock** | ✅ comma + header | 7–50 | ❌ rejected |
| **Adobe Stock** | ✅ comma + header | 5–49 (ordered) | ✅ labelled |
| **Magnific** (ex-Freepik) | ✅ semicolon, single quotes, no header | up to 50 | ✅ labelled |
| **Pixabay** | copy sheet | ≤ 20 tags | portal rules |
| **Dreamstime** | ✅ comma + header | 7–50 | ✅ labelled |
| **123RF** | ✅ comma + header | 10–50 | ✅ labelled |
| **Depositphotos** | ✅ comma + header | ≥ 8 | ❌ rejected |
| **Vecteezy** | ✅ comma + header | 5–50 (first 5 weighted) | ✅ labelled |
| **Getty / iStock** | copy sheet | portal form | ❌ banned |
| **Alamy** | copy sheet | portal form | ❌ rejected |
| **Pond5** | ✅ comma + header | 5–50 | ❌ not accepted |
| **VectorStock** | preview IPTC only | up to 60 | ❌ vectors only |
| **Canva Creators** | ✅ comma + header | ≥ 5 (UI cap 20) | ✅ labelled |
| **Envato Elements** | author dashboard | ≤ 50 tags | ✅ labelled |

Values marked "portal form" have no CSV importer, so the app generates a
copy-paste sheet with the exact fields in the right order.

## ✨ What's inside

| Module | What it does |
| --- | --- |
| **Image understanding** | Every upload is decoded and measured in the app: scene type, palette with colour names, subject placement, flat-colour and text layout, transparency, sharpness, noise, exposure, clipping, colour range and bits per pixel. Runs offline and drives the suggestions below. |
| **Metadata AI** | Free by design, three routes: the built-in offline generator, a model on your own machine (Ollama or any OpenAI-compatible server), or a free-tier cloud key (OpenRouter, Gemini, Mistral, NVIDIA, Groq, Cerebras, Together). Live connection test, real error messages, keys stored locally. Titles, descriptions and keywords are drafted from what the picture actually shows. |
| **Library** | Import JPG, PNG, WebP, EPS, AI, SVG. Existing IPTC/XMP is read on import. Grid or list, search, format filters, batch generate, batch embed, metadata templates, near-duplicate scan (64-bit dHash), folder watching on desktop. |
| **Prepare** | Strip EXIF/GPS and Photoshop blocks, re-encode through sRGB to any portal's size budget, sanitise SVG (scripts, handlers, `@import`, editor namespaces) and report on EPS/AI internals (CMYK, live fonts, rasters, Illustrator version). |
| **Vector Studio** | A full illustration editor: 11 drawing tools, 174 ready elements across eight searchable categories, six editable templates, marquee select, resize/rotate handles, snapping guides, flip and centre, layer search with rename and drag reorder, alignment, select-same-colour restyling, 80-step undo, live preview. Opens SVG, EPS, AI and PS as editable objects (PostScript paths, colours, arcs, text and transforms are read in the app) and exports sanitised SVG, PNG at 1×/2×/4×, a true vector EPS or an Illustrator compatible AI file. |
| **Quality Checker** | Scores artwork before upload: vector editability (flattened raster exports, `foreignObject`, fonts left live, hairline strokes, auto-trace complexity) plus sharpness, detail density, split clipping, colour cast, saturation, grain, compression, transparency in JPEG, file weight, near-duplicates, and a per-agency pass/fail list. Audit the whole library in one click. Exports a JSON report. |
| **Image Optimizer** | Re-encodes to JPEG, WebP, AVIF or PNG with a visually-lossless sweet spot or an exact KB target, optional long-edge downscale and metadata stripping. PNG output picks the smaller of truecolour and a 256 colour palette (with an adjustable palette size), which takes flat artwork down by 70 to 90 percent losslessly. Never writes a larger file than it read. |
| **Upscale** | Built-in resampling and selectable local GPU models, with the model, marketplace preset and output format recommended from the image itself and the reason shown on screen. Review each model and weights licence before commercial use. |
| **Export** | Exact CSV dialects for every portal above, UTF-8 BOM, platform-safe renaming, batch embedding, planner hand-off, plus re-import of existing metadata CSVs. |
| **Platforms** | A dense reference for all 14 marketplaces: formats, resolution windows, file caps, keyword rules, title caps, CSV layout and AI policy. |
| **Planner** | Per-portal queues (todo → queued → submitted → accepted / rejected) with real publishing caps, including Magnific's first-batch window and monthly limit. |
| **Releases** | Model and property release registry with expiry tracking and per-file linking; validation warns when commercial work shows people without a release. |
| **Earnings** | Import each portal's sales CSV with automatic column detection, get one ledger, a monthly trend, per-platform totals and best sellers. |
| **Security** | Password change with re-authentication, emailed reset links, TOTP two step verification (QR code or manual key) enforced at sign-in, and sign out everywhere. Available to every role, administrators included. |
| **Cloud** | Legacy sync is disabled for security. Local backup and restore remain available. |
| **Background remover** | Local cutout with a full-resolution erase/restore mask editor; edited results export as transparent PNG. |
| **Video** | Basic resize/sharpen presets only. Neural video models and frame interpolation are not yet connected. |

## 🚀 Build from source

```bash
git clone https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro.git
cd Micro-Stocker-Advanced-Pro
npm install

npm run dev        # Electron window + hot reload
npm run dev:web    # browser-only preview
npm run verify     # typecheck + tests + production build
npm run dist:win   # Windows installer + portable exe into ./release
```

Node 20+ (22 recommended). Linux/macOS builds work with `npm run dist:linux`
and `npm run dist:mac`; a macOS `.dmg` needs to be produced on macOS.

## 🧪 Testing

```bash
npm test          # 38 unit and integration checks, plus licensing SQL
npm run test:browser   # auth gate, mask editor and video encoder in Chromium
```

The unit suite tests licensing SQL with an embedded PostgreSQL instance, renders
each page on the server, and runs domain checks on Node: every CSV dialect,
validators, the metadata engine, binary IPTC/XMP round-trips through real
PNG/JPEG/SVG/EPS fixtures, SVG/EPS analysis and hardening, spreadsheet formula
neutralising, upscale recommendations, password policy, sales parsing, planner
maths, and a completeness check that all 14 marketplaces carry a brand mark, a
colour and a workflow.

### Interface and security audits

Run these against the dev server (`npm run dev:renderer` with
`VITE_DEMO_MODE=1`):

```bash
npm run qa:deep               # 24 routes x 10 widths: overflow, clipping, overlap, tap targets
npm run qa:a11y               # axe-core, WCAG 2.1 AA, light and dark
npm run qa:layout             # route render smoke
npm run qa:contrast           # token contrast pairs
npm run qa:vector             # 15 Vector Studio interactions
npm run qa:interaction        # menus and dialogs at desktop and phone widths
npm run qa:text               # dash, hint and placeholder copy guard
npm run qa:suggest            # upscaler and optimizer recommendations
npm run qa:security-rules     # offline network policy unit checks
npm run qa:security           # TOTP, password change and sign-in challenge
```

## 🏗 Architecture

```
electron/          main + preload (fs, dialogs, upscaler, folder watcher)
src/
  components/      design system (buttons, cards, tables, fields) + shell
  lib/stock/       platforms, csv, csvimport, validate, metadata, xmp, files,
                   categories, dupes, filedoctor, vectorcheck, quality, sales,
                   submissions, sync + upscale/{models,engine,classic}
  lib/vector/      SVG document model, path → PostScript, vector EPS writer
  lib/tools/       converter (+codecs), optimizer, bgremove, videoupscale
  state/           app, toast, library, bank, releases
  pages/           Overview, Library, Prepare, Export, Vector, Quality,
                   Optimize, Upscale, Video, Background, Convert, Platforms,
                   Planner, Releases, Earnings, Bank, Cloud, Settings, About
tests/             runtime suite + binary fixtures
docs/              CI workflow template, user guide, assets
```

Renderer routes are code-split; the shell plus first page is ~150 kB gzipped.

## 🔒 Privacy

- Local image and video tools process artwork on your machine. Optional cloud AI services may receive content you choose to send.
- Account and subscription verification require a network connection. Legacy cloud sync is disabled.
- The backend URL is visible to users; security relies on authorization, not hiding infrastructure.

## 📄 Licence

**Source-available proprietary licence** — see [LICENSE](LICENSE).

- ✅ Install and use official builds, personally or commercially.
- ✅ Build from source for your own use, and contribute changes back.
- ❌ Redistribute, mirror, resell, rebrand or publish modified builds.
- ❌ Remove or alter copyright and licence notices.

Versions up to and including **v1.0.0** were released under MIT and remain
available under those terms for anyone who obtained them.

Marketplace names and logos are trademarks of their owners and appear only to
identify the portal a file is prepared for. This project is independent and is
not affiliated with, endorsed by or sponsored by any marketplace. Third-party
component licences are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## 💬 Support

- [User guide](docs/user-guide.md)
- [Open an issue](https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro/issues)

<div align="center">

**Built for contributors, by a contributor.**

</div>
