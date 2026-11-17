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
  Magnific FTP, Illustrator 8 for 123RF), CMYK usage, live fonts, embedded
  rasters and missing `%%BoundingBox`.

## 4. Vector Studio

A small illustration app inside the workspace: quick enough to draw a badge in a
minute, precise enough to clean up a real SVG.

- **Start** — six canvas presets, six editable templates (sale badge, price tag,
  quote card, product frame, story cover, logo mark), or drop your own SVG.
- **Draw** — rectangle, rounded box, ellipse, circle, triangle, diamond, star,
  polygon, line, arrow and text. Drag to size a shape; click to drop the default
  size; hold Shift while dragging a corner to keep the proportions.
- **Select and transform** — click an object, Shift+click for several, or drag a
  marquee across empty canvas. Drag the body to move, the eight handles to
  resize, the round handle to rotate. Objects snap to the canvas edges and
  centre with pink guide lines.
- **Style** — fill swatches plus a colour picker, stroke colour and width,
  opacity, rotation, corner radius, and text size, weight, tracking and
  alignment. X/Y/W/H fields give exact numbers, and the align row snaps objects
  to the canvas or to each other. Group, ungroup, duplicate, reorder and lock.
- **Elements** — 80+ ready shapes, marketplace icons, arrows, frames and
  commerce marks. They insert centred and stay fully editable, and every new
  insert steps across the canvas so it never hides behind the last one.
- **Import** — `Open SVG` replaces the canvas with a real, editable document;
  dropping a file (or `Open SVG` while another artwork is open) places it as a
  group that you can move, scale and restyle.
- **Live preview** — the panel in the inspector renders the current document on
  every change, exactly as exported. **Present** opens it full screen.
- **Export** — sanitised SVG, PNG at 1×, 2× or 4×, or a vector EPS built from
  PostScript paths. Live text is reported as skipped in EPS because agencies
  require outlines.
- **Never lose work** — every change is undoable (⌘/Ctrl+Z, ⇧⌘Z) and the canvas
  is autosaved locally; reopen the studio and your last artwork is there.

Shortcuts: `V` select, `R` rectangle, `U` rounded box, `O` ellipse, `C` circle,
`G` triangle, `D` diamond, `S` star, `P` polygon, `L` line, `A` arrow, `T` text,
arrows nudge, `Shift`+arrows nudge further, `[` / `]` send back / bring front,
`0` fit, `Space`+drag pans, ⌘/Ctrl+scroll zooms.

## 5. Quality Checker

Drop JPG, PNG, WebP, AVIF, SVG, EPS or AI files before uploading them.

- Each file gets a 0–100 score and a verdict (**Ready**, **Review**, **At risk**).
- Vector checks answer "is it really editable?": flattened raster exports,
  embedded HTML (`foreignObject`), live text without fonts, missing `viewBox`,
  white background plates, filter dependencies and auto-trace complexity.
- Raster checks: resolution against each agency's minimum, sharpness, blown
  highlights, file weight and near-duplicates already in your library.
- Every issue carries a one-line fix, and each agency is marked pass or fail with
  the reason. **Report** downloads the whole run as JSON.

## 6. Image Optimizer

- Choose the output format (keep, JPEG, WebP, AVIF, PNG), then **Auto** (the
  format's visually-lossless sweet spot), **Target KB** (binary-searched) or an
  explicit quality.
- Optional long-edge resize only ever shrinks, and camera metadata can be
  stripped.
- Files that cannot be made smaller keep their original bytes — the optimizer
  never returns a heavier file.

## 7. Upscale studio

Three fields: **source**, **target**, **engine**.

- **Resampler** — high-quality stepped enlargement, always available, any
  machine.
- **AI · GPU** — one 43 MB download of the portable Real-ESRGAN NCNN-Vulkan
  build (BSD-3-Clause weights, commercial output allowed), then 4× passes on
  your GPU. Pick a model: general photos, conservative (RealESRNet), flat
  colour/line art, or the fast anime-video model.
- **Targets** — 8K UHD, 4K UHD, Adobe 24 MP, Alamy 6 MP, Magnific 4000 px, or
  "clear every minimum". The plan shows the exact pixels before you run.
  Real-ESRGAN only ships 4× weights, so a fractional gap is closed with one
  final resize rather than a made-up model scale.
- Large images use tiled passes so 8K output does not exhaust VRAM. Results
  land back in the library as new items.

## 8. Metadata generation — free, three routes

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

## 9. Export centre

1. Tick the target platforms (each chip shows its brand mark).
2. Choose *selection* or *whole library*.
3. Download each CSV — exact dialect per platform — or copy it.
4. **Rename safe** fixes filenames to platform-safe characters; **Embed all**
   writes IPTC/XMP; **Mark queued** hands the batch to the planner.

Blocking validation errors are listed per platform; warnings are advisory.

## 10. Submission planner

Per platform: todo → queued → submitted → accepted/rejected, with counts and
cap advisories (Magnific: first batch 150-200 files of the same format, then
200 per month). Queue from validation-passing files only, or move anything
across with the dropdown.

## 11. Releases, Earnings, Keyword bank

- **Releases** — register model/property releases, expiry dates and the files
  they cover; the validator warns on commercial files showing recognisable
  people without a linked release.
- **Earnings** — import each portal's sales CSV (columns auto-detected, manual
  remap preview included). One ledger, monthly trend, per-platform totals,
  best sellers, CSV export.
- **Keyword bank** — your synonyms and category banks feed every generation;
  the mini dictionary appends ES/DE/FR keywords from the item editor.

## 12. Cloud & backup

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
