# User guide

Micro Stocker Advanced Pro in one workflow:

**Import → Clean → Upscale → Generate → Validate → Embed → Export → Track**

An account, an internet connection and an active subscription are required to access the workspace. The Subscription page remains available for activation and administration. Legacy cloud sync is disabled for security; see [licensing setup and remediation](licensing-setup.md).

---

## 1. Library

- **Import files** — desktop build opens a native multi-select dialog; the
  browser preview uses the standard file picker. Existing IPTC/XMP in JPEG/PNG
  is read automatically and becomes the item's metadata.
- **Watch folder** (desktop) — pick a folder; every new stock file that lands
  in it is imported (debounced). Stop any time from the same button.
- **Generate all** — writes titles, descriptions and 7-50 keywords from
  filenames plus your keyword bank. Select items first to limit the batch.
- **Embed all** — writes IPTC/XMP into the files (with `.msap-backup`
  originals next to them). Do this *before* uploading: Adobe, Shutterstock,
  Dreamstime, 123RF, Depositphotos, Getty and Alamy pre-fill from it.
- **Find duplicates** — 64-bit perceptual dHash over raster files; clusters
  within 8 differing bits are near-identical at thumbnail scale (the kind of
  similarity Adobe and Vecteezy reject).
- **Template** — batch title/description/keyword patterns with `{name}`,
  `{format}`, `{index}`, `{count}`, `{category}`.
- **Import CSV** — re-use an earlier metadata CSV (this app, Xpiks, or a
  portal download). The dialect is detected; rows are matched by filename and
  merged into your library.

## 2. Item editor

Open any card. Tabs:

- **Metadata** — title, description, keyword chips (click to remove), bulk
  keyword box, categories, flags (AI, editorial, mature, illustration,
  Vecteezy licence), release linking and **+ ES/DE/FR** translation append.
- **Platforms** — per-platform preview of the adapted title/keywords with live
  validation; copy the adapted keyword list straight to the clipboard.
- **Embed** — write/read IPTC/XMP for this single file.

## 3. Prepare

- Select files → **Clean** strips EXIF/GPS and Photoshop scratch data, then
  re-encodes through an sRGB canvas stepping quality and scale until the file
  fits the target platform's size budget. Vectors are never re-encoded.
- **Vector check** — SVG sanitizer (scripts, inline handlers, `@import`,
  editor namespaces) and an EPS/AI report: Illustrator version (CS6 needed for
  Freepik FTP, Illustrator 8 for 123RF), CMYK usage, live fonts, embedded
  rasters and missing `%%BoundingBox`.

## 4. Upscale studio

Three fields: **source**, **target**, **engine**.

- **Resampler** — high-quality stepped enlargement, always available, any
  machine.
- **AI · GPU** — one 43 MB download of the portable Real-ESRGAN NCNN-Vulkan
  build (BSD-3-Clause weights, commercial output allowed), then 4× passes on
  your GPU. Pick a model: general photos, conservative (RealESRNet), flat
  colour/line art, or the fast anime-video model.
- **Targets** — 8K UHD, 4K UHD, Adobe 24 MP, Alamy 6 MP, Freepik 4000 px, or
  "clear every minimum". The plan shows the exact pixels before you run.
  Real-ESRGAN only ships 4× weights, so a fractional gap is closed with one
  final resize rather than a made-up model scale.
- Large images use tiled passes so 8K output does not exhaust VRAM. Results
  land back in the library as new items.

## 5. Metadata generation — free, three routes

Open **Settings → AI metadata**. Nothing here is required; the built-in
generator (filename + your keyword bank) always works, offline.

| Route | Cost | Setup |
| --- | --- | --- |
| Built-in | free, offline | none |
| **Ollama** or **LM Studio** on this machine | free, offline | install the app, pull a model (e.g. `ollama pull llama3.1:8b`), press **Detect models** |
| **OpenRouter / Gemini / Mistral / NVIDIA / Groq / Cerebras / Together** | free tiers, your own key | paste a key from the provider's console |

- **Test** sends one tiny real request and reports exactly what came back —
  a rejected key, a wrong model name, or a rate limit each get their own
  message.
- **Creativity** trades literal keywords for more varied ones.
- Keys are stored in the same local store as the rest of the app; they are
  only ever sent to the provider you selected, from this computer.
- If a provider call fails mid-batch the batch still completes on the built-in
  generator, and the toast tells you why.

## 6. Export centre

1. Tick the target platforms (each chip shows its brand mark).
2. Choose *selection* or *whole library*.
3. Download each CSV — exact dialect per platform — or copy it.
4. **Rename safe** fixes filenames to platform-safe characters; **Embed all**
   writes IPTC/XMP; **Mark queued** hands the batch to the planner.

Blocking validation errors are listed per platform; warnings are advisory.

## 7. Submission planner

Per platform: todo → queued → submitted → accepted/rejected, with counts and
cap advisories (Freepik: first batch 150-200 files of the same format, then
200 per month). Queue from validation-passing files only, or move anything
across with the dropdown.

## 8. Releases, Earnings, Keyword bank

- **Releases** — register model/property releases, expiry dates and the files
  they cover; the validator warns on commercial files showing recognisable
  people without a linked release.
- **Earnings** — import each portal's sales CSV (columns auto-detected, manual
  remap preview included). One ledger, monthly trend, per-platform totals,
  best sellers, CSV export.
- **Keyword bank** — your synonyms and category banks feed every generation;
  the mini dictionary appends ES/DE/FR keywords from the item editor.

## 9. Cloud & backup

- **Cloud connection** — paste a Supabase URL + anon key, run the shown SQL,
  then Push/Pull library descriptors. Last-write-wins per item.
- **Settings → Back up** — exports every stored key (library, releases,
  planner, bank, sales, settings) as one JSON file. **Restore** on any machine
  and the app reloads with your workspace. Artwork bytes always stay on disk.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl / ⌘ + K` | Focus page search |
| `Ctrl / ⌘ + B` | Collapse / expand sidebar |
| `Ctrl / ⌘ + =` / `-` / `0` | UI zoom in / out / reset |
| `Esc` | Close dialogs and the nav drawer |

## Troubleshooting

- **WebP won't embed** — the format cannot gain an XMP chunk after the fact;
  export as PNG or JPG (the app says exactly this).
- **PDF-based `.ai` won't embed** — re-save as EPS from Illustrator, or embed
  into the paired JPG/EPS preview.
- **A portal rejects my CSV** — open the platform card in **Platforms** and
  compare limits; then run **Rename safe** and check the blocking list in the
  Export centre.
- **Upscaler missing** — the Real-ESRGAN binary is downloaded on first use
  from the official GitHub release; the desktop build stores it under your
  user data folder.
