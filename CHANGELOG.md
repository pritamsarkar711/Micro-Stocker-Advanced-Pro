# Changelog

All notable changes to Micro Stocker Advanced Pro are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-11-15

First public release of the complete microstock contributor workbench.

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
