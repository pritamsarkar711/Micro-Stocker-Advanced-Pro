# Changelog

All notable changes to Micro Stocker Advanced Pro are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.3.0] - 2026-11-17

### Added
- **A real first start.** The app opens on a branded splash, then a welcome
  screen, then three tour slides that explain metadata, export and the studio
  tools. Registration or sign-in comes next, and the dashboard only mounts after
  the account is ready. A returning account goes from the splash straight in, and
  a session survives a reload.
- **Phone app bar and search sheet.** The top bar names the current page, and the
  search button opens a full-screen sheet that filters every tool, and every
  library file by name or title, as you type.
- **More button in the tab bar.** Four destinations stay one tap away and the
  fifth opens the whole rail as a drawer, with the account card pinned at the
  bottom.
- **Metadata editor as a sheet.** Tapping an asset on a phone or tablet opens the
  editor in a bottom sheet instead of a panel a screen and a half below the grid.
- **Sticky page actions.** Generator and tool pages keep their primary button
  pinned above the tab bar on a phone, so it is never two scrolls away.
- **`scripts/qa/mobile-audit.mjs` and `scripts/qa/launch-flow.mjs`.** Four device
  sizes across every route check horizontal overflow, escaping elements, tab-bar
  clearance and tap-target size; the launch script walks the whole first-run flow.

### Changed
- **Built for a thumb.** Buttons and fields grow a step at phone sizes, every
  checkbox and slider gets a real hit area, form controls sit at 16 px so iOS
  never zooms on focus, and carousels and tab strips swipe instead of squeezing.
- **Nothing leaves its box.** Marketplace cards are full-width rows on a phone,
  the platform list no longer clips names, wide tables scroll inside their card,
  and the admin tiles read as a 2×2 block.
- **Safe areas respected.** Header, tab bar, drawer, splash and sheet all pad for
  the notch and the home indicator, and landscape shortens the bar without
  dropping its labels.
- **Registration speaks plainly.** Inline validation replaces the browser bubble,
  and the create button says what it does.

## [2.2.0] - 2026-11-17

### Added
- **One workspace across devices.** Settings, presets and workspace metadata sync
  through the account with a newer change wins rule, a device list and a manual
  push and pull on the Sync and devices page. Image pixels never leave the device.
- **Live crypto settlement.** The checkout creates an invoice with the coin, the
  network, the exact amount and a copy button, then watches it. The verifier reads
  the chain over public RPC, compares destination, amount, network, confirmations
  and transaction time, refuses a reused hash, and activates the plan without a
  human. A scheduled scan covers invoices whose tab was closed.
- **Admin Payments tab.** Wallet addresses, token contracts, confirmations and an
  enable switch per asset, saved straight to the server.
- **Tokens.bd as the model supply.** One key reaches every model. DeepSeek 4.1
  Flash is live; Gemini, MiniMax, Kimi and the image model are seeded switched off
  until their ids are confirmed.

- **Android app.** The same bundle now ships as an installable APK with the
  studio branding, a share sheet for exported files and the whole workspace
  available on a phone.
- **Add models and providers from the console.** Admin → Providers can create an
  OpenAI-compatible endpoint and any model row (upstream id, display name, kind,
  per-million price, enabled) without a new release. Both writes are admin only,
  audited and closed to anonymous callers.

### Changed
- **Credits are charged by the four generators only.** Premium background, upscale
  and video models now need a plan and cost nothing, and the plan cards state the
  included and the excluded features side by side.
- **Generators speak plainly.** The field is called Idea, the seasonal suggestion
  chips are gone, the credit count is an icon and the model selector covers
  DeepSeek, Gemini and MiniMax.
- **Official payment marks.** The real bKash and Nagad artwork replaces the redrawn
  wordmarks, and the heavy cutout models carry a lock for free accounts.
- **Less text, more width.** Settings, security, generators and the admin console
  lost their explanatory paragraphs, and the narrow centred columns are gone.
  Warnings are a small banner with a close button.

### Fixed
- Crypto invoice approval failed because the verifier had lost its execute grant
  after the settlement function was tightened.
- Token amounts were read with six decimals on chains whose tokens use eighteen,
  and Solana tokens were matched against the native balance instead of the mint.
- An unrelated transfer into a wallet could mark a waiting invoice as wrong.
- The output panel header was flush against its card edge, and overlapping text
  in the spend by model and your order panels is gone.

## [2.1.0] - 2026-11-17

### Added
- **Subscription page is a real checkout.** Three tiers by monthly, six month and
  yearly terms, a feature comparison against the free tier, the current plan with
  its expiry and credit balance, and order history with crypto confirmations.
  Paying with bKash or Nagad takes the number, the TrxID and an optional sender, and
  paying with crypto creates an invoice with the exact amount, the address and a
  confirmation counter.
- **Admin console.** Revenue, provider cost and margin for the last thirty days,
  spend per model, pending work and the audit tail; order review with a note; user
  search with plan grants and credit adjustments; editable plan prices, credits and
  visibility; provider keys, enable switches and per model costs; JSON editors for
  the credit table, daily limits, payment windows and the BDT rate.
- **Coin and wallet marks.** Nine coin marks (BTC, USDT, USDC, BNB, SOL, LTC, DAI,
  TRX, MATIC) drawn from their real vector artwork, plus bKash and Nagad marks.
- **Video upscaler has a free tier.** Free renders stop at 2K QHD; 4K, 8K and the
  60 fps stock presets are Pro. Gated presets are marked and a downgrade moves the
  selection back to Full HD.

### Changed
- Every price, credit count and provider cost in the console is shown in taka, so
  no screen mixes currencies.
- Crypto amounts print to six places, the precision wallets show, instead of an
  eighteen digit tail.
- The checkout sheet stays open after an order so the receipt or the invoice stays
  on screen until it is dismissed.

### Fixed
- Placing an order closed the sheet before the crypto invoice could be read.
- The admin overview printed raw dollars next to taka revenue.
- Plan badges read `Active · renews` with no date for administrator accounts.

## [2.0.0] - 2026-11-17

### Added
- **New identity.** A rebuilt logo mark (pink tile, corner brackets, aperture dot)
  plus matching favicons, app icons and installer artwork in every size.
- **Open EPS and AI artwork in Vector Studio.** Files are read in the app: paths,
  colours, stroke widths, line caps, joins, dashes, arcs, text and transforms are
  converted into editable objects, with skipped PostScript operators reported
  instead of failing silently. Files without vector data fall back to their
  embedded preview so they can still be inspected.
- **Export AI.** Illustrator compatible output alongside SVG, EPS and PNG up to 4x.
- **26 new vector elements** (dividers, ribbons, badge sets, hexagon, dotted,
  corner and arch frames, curved, loop and dashed arrows, sun, cloud, leaf, chat,
  browser, phone, cursor and avatar shapes) for 174 elements in total.
- **Select same colour** in Vector Studio to restyle every object that shares the
  current fill or stroke in one step.
- **Palette PNG (PNG-8)** in the Converter and a palette size control in the
  Optimizer. Flat artwork, logos and illustrations drop 70 to 90 percent in size
  losslessly, and the Optimizer keeps truecolour whenever quantising would show.
- **Settings: workflow defaults.** Confirmation before removing assets, plus the
  starting output format for the Optimizer and the Upscaler.

### Changed
- **The library can now let go.** Every asset has a remove action, selections can
  be removed in bulk, and **Clear library** empties the workspace so a different
  file set can be imported. Files on disk are never touched.
- **Metadata is written from the picture.** The local engine now describes what it
  sees (scene, subject placement, negative space, palette, focus, grain) and the
  title, description and keywords are drafted from that, not from the old title.
- **The Metadata Editor shows what the app sees**: scene badge, match confidence,
  negative space, detail tags, palette dots and a measured quality score.
- **The Quality Checker measures focus without being fooled by grain.** Sharpness
  now reads edge acutance after grain removal, so a noisy phone frame is no longer
  reported as crisp and a clean studio frame is no longer reported as soft.
- **Topbar search works.** The field opens a command palette with page jumps and
  library results, arrow key navigation, Enter to open and Ctrl or Cmd K to focus.
- **Upscaler output is smaller.** WebP at a balanced quality is the default, and
  the quality readout says Max, Balanced or Compact instead of guessing.

### Performance
- **Strip wise image filtering.** The upscaler's sharpen and restore passes now
  work in 512 row strips instead of two full frame copies, cutting the memory
  working set on a 24 MP frame from roughly 200 MB to under 10 MB and removing the
  allocation spike that spun up fans.
- **Video renders on new frames only.** The capture loop now uses the decoder's
  frame callback and a frame interval check, so a 30 fps clip is drawn 30 times a
  second instead of 60 to 120, with less GPU load, heat and battery drain.
- Trimmed instructional copy from both upscaler pages.

## [1.9.0] - 2026-11-17

### Added
- **A real image understanding engine.** Uploaded artwork is now decoded and
  measured in the app: 14 scene categories, an 8 colour palette that knows its own
  colour names, subject placement, skin and sky share, flat-colour and text-layout
  detection, transparency, plus a quality read out of sharpness, noise, exposure,
  clipping, colour range and bits per pixel. It runs offline on every platform and
  feeds every suggestion below.
- **Smarter upscale recommendations.** The upscaler reports what it measured
  ("soft edges, clean grain, 1.9 MP"), then picks the model, marketplace preset and
  output format that fits, and keeps the reason on screen with a one click
  **Use suggestion**.
- **Metadata drafted from the picture, not from the filename.** Titles, descriptions
  and keywords come from the scene, palette, subject placement and time of day,
  with commercial buyer terms added and duplicates, filler and over-long keywords
  filtered out.
- **AI drafts get the same picture.** The prompt now carries the measured scene,
  palette, subject position and quality notes, and the returned title, description
  and keywords are length checked and ranked so searchable terms come first.
- **From Library in the Quality Checker.** Audit every asset already in the
  library without picking files again.
- **Error budget for AI models.** A model that is not available on the provider
  surfaces the provider message and the fix instead of a silent failure.

### Changed
- **First paint is 1.2 MB lighter.** The 4.4 MB codec bundle no longer loads on
  launch; only the framework shell is preloaded and every codec arrives with the
  tool that needs it.
- **Library scales to large collections.** Previews load as rows render instead of
  reading every file at startup, and the grid renders in pages of 60 with a
  **Show 60 more** control.
- **Restoring a backup is validated.** Imported JSON is rebuilt field by field, so
  unknown fields, wrong types, prototype keys and oversized strings cannot enter
  the library; the toast says when only metadata could be restored.
- **Card headers wrap on narrow screens**, so three actions never push a button
  past the card edge.
- **Stripping EXIF re-inspects the file**, so the list shows Clean instead of
  advertising tags that were just removed.

### Fixed
- Export CSV column list clipped mid word on narrow screens.
- Library row titles were cut to one line with an ellipsis; they now show two.
- Quality Checker had no way to audit library assets.
- Model catalogue and provider errors no longer hide behind a generic failure.

### Audited
- 24 routes at ten widths (320 to 1920), axe-core WCAG 2.1 AA in both themes,
  interaction, contrast, text, suggestion, vector, security rule sweeps, and an
  end to end run of all six studio tools with real files: upscaler, background
  remover, optimizer, converter, quality checker and the library import plus
  offline metadata draft.

## [1.8.0] - 2026-11-17

### Added
- **Automatic suggestions in the tools.** The upscaler inspects the first image
  and preselects a model, marketplace preset and output format with a one line
  reason ("Edge Guided Sharp for this cutout"), and keeps **Use suggestion**
  available after you change anything. The optimizer names the best format for
  the file it just read. The quality report opens with the single next step and
  a button that opens the tool that fixes it. The overview suggests what to do
  next based on the state of the library.
- **Password strength meter** on create, reset and change password, with the most
  common passwords refused.
- **Two step attempt limit** in the local demo client: five wrong codes lock the
  factor for five minutes.
- **Strict Content Security Policy** in packaged builds (no inline scripts, no
  remote code, no frames, no plugins) and a build time `theme-boot` script so the
  first paint is still correct without inline JavaScript.
- **IPC path approval.** The desktop bridge now reads and writes only files the
  user picked or watched, remembers those choices across restarts, and validates
  every URL it downloads a model from.
- **Network policy for the desktop proxy.** Public HTTP(S) only, loopback allowed
  for local AI servers, cloud metadata, private ranges, `.local` names, embedded
  credentials and `javascript:` URLs refused, redirects re-checked per hop, and
  responses capped at 32 MB.
- **Hardened SVG sanitiser.** Removes `<foreignObject>`, iframes, embeds,
  handlers, `javascript:` and inline SVG data URLs, remote CSS references and
  editor namespaces.
- **Universal CSV column test** proving every row keeps the same seven columns
  when titles, keywords and categories contain commas and quotes.
- **Spreadsheet formula injection guard** in every CSV export: cells that start
  with `=`, `+`, `@`, a tab or a formula-like `-` are prefixed with an apostrophe.
- New audits: `qa:deep` (24 routes x 10 widths), `qa:a11y` (axe-core, WCAG 2.1 AA,
  light and dark), `qa:interaction`, `qa:security-rules`, `qa:suggest`, `qa:text`.

### Changed
- Links that looked like buttons are now single anchors instead of a button
  nested inside a link, in the overview, prepare, export, subscription, contact,
  about and not found screens.
- Every switch, slider, select and text field has an accessible name. Sidebar
  secondary text and subscription card labels were lightened to clear AA.
- Type scale floor raised to 11.6px for labels previously below it; small
  monogram tiles keep readable initials.
- Security card spans the full settings row so the password form and QR code fit.
- Tap targets are at least 28px: toolbars, list row actions, key visibility, the
  switch, the preview link and the mobile tab bar.

### Fixed
- White on pink gradient labels on the subscription card no longer sit under the
  4.5:1 threshold.
- Upscaler no longer offers a JPG marketplace preset for transparent artwork,
  and the drop zone shrinks once a queue exists so the work area stays visible.
- Optimizer no longer suggests a lossless PNG for a transparent source unless the
  source really is PNG.
- Quality prioritisation now ranks resolution and focus above file weight, so a
  60 KB soft photo is not sent to the optimizer.
- Mobile overview no longer truncates KPI labels.

## [1.7.0] - 2026-11-17

### Added
- **Account security in Settings.** Change password with the current password as
  confirmation, email yourself a reset link, turn two step verification on or
  off with any TOTP authenticator app (QR code, manual key and 6 digit check),
  and sign out of every device. The sign-in screen now asks for the
  authenticator code when a factor is enrolled, and the Forgot password flow
  produces a recovery link from the same screen. Administrators use the same
  panel.
- **A much larger Vector Studio library.** 150 elements across eight categories
  (shapes, commerce, arrows, frames, icons, interface, nature, people) with
  instant search, plus two new frames, arrow and interface families.
- **Real layer management.** Search, in-place rename, drag to restack,
  Shift+click multi-select, hide and lock, with group counts.
- **More editing tools.** Flip horizontally or vertically, centre on the canvas,
  duplicate from the transform row, and copy or paste objects with
  ⌘/Ctrl+C and ⌘/Ctrl+V.
- **Deeper quality analysis.** Split highlight and shadow clipping, colour cast,
  over-saturation, grain, detail density, bytes-per-pixel compression checks,
  transparency-in-JPEG detection and hairline stroke warnings for vectors.
- **Smarter optimizer.** A second lower-quality pass and a stepwise long-edge
  reduction replace the old "give up at the floor" behaviour, so target sizes are
  met without visible mush.

### Changed
- **Typeface replaced with IBM Plex Sans** (400, 500, 600 and 700, self-hosted,
  latin and latin-ext). The currency subsets stay for `৳` and `₹`.
- **Colour is strictly pink.** Success and attention tones are now pink and plum
  in both themes; no green remains anywhere in the interface.
- **No forbidden iconography.** Flash, bolt, thunder, warning, alert, sparkle,
  shield and magic glyphs are gone from every screen, action and empty state.
- **Shorter copy.** Autosave banners, canvas hints, "nothing selected" and
  "nothing here yet" paragraphs, verbose dropdown hints and duplicate headings
  are removed across the studio and the tools.
- **No em or en dashes** in interface text, table placeholders or template
  titles.

### Fixed
- Quote card template no longer overflows its artboard; the line lengths fit the
  1600 x 2000 canvas.
- Window controls: the close button keeps a white glyph on its red hover state,
  and all three buttons share one radius, height and focus ring.
- Badges no longer print icon names as text, blank icons no longer appear in the
  auth and quality screens, and password, code and email fields are properly
  labelled for screen readers.
- "Clear" actions across the tools now use an icon that exists in the subset.
- Optimizer never returns a heavier file.

## [1.6.0] - 2026-11-17

### Added
- **Vector Studio is now a real editor.** Eleven drawing tools (rectangle,
  rounded box, ellipse, circle, triangle, diamond, star, polygon, line, arrow,
  text), drag-to-draw with Shift-constrained proportions, marquee and
  Shift+click multi-select, eight resize handles, a rotate handle, snapping to
  canvas edges and centre with on-canvas guides, an X/Y/W/H inspector, align and
  distribute, group/ungroup, lock and hide, layer reordering, and 80 steps of
  undo/redo. Keyboard shortcuts cover every tool plus nudge, zoom and fit.
- **An element library.** 80+ shapes, commerce marks, arrows, frames and icons
  across five categories, six editable templates (sale badge, price tag, quote
  card, product frame, story cover, logo mark), and a cascade so inserts never
  land on top of each other.
- **Real SVG import that stays editable.** Open a file as the document, or drop
  it into the current artwork as a scalable group. Parsing drops scripts,
  handlers, external references and unknown nodes before anything touches the
  canvas.
- **Live preview and presentation.** The inspector renders the current document
  on every change — the same artwork the exporter produces — plus a full-screen
  Present mode. PNG export now offers 1x, 2x and 4x.
- **Autosave.** The studio restores your last artwork when you come back.
- **Contrast auditing.** `scripts/qa/contrast.mjs` walks every text node on all
  24 routes in both themes, composites translucent backgrounds and checks WCAG
  AA. The suite now reports zero failures.
- **Vector regression suite.** `scripts/qa/vector-check.mjs` draws, resizes,
  rotates, types, inserts, multi-selects, imports and exports a document on
  every run.

### Changed
- **New typeface: Plus Jakarta Sans.** The Telenor family is gone. The UI now
  ships a self-hosted variable face (200–800, upright and italic, latin and
  latin-ext) with the two Noto currency subsets kept for `৳` and `₹`. Nothing is
  fetched from a font CDN at runtime.
- **Colour, corrected in both themes.** Brand fills and brand ink are now
  separate tokens: `--brand` paints text, icons, borders and rings, while
  `--brand-solid` paints every fill that carries white text. That moves white on
  pink from 3.8:1 to more than 8:1 without dulling the accent, and fixes the
  active sidebar item, buttons, tabs, chips and badges at once. Faint text
  (`--fg-subtle`) was darkened in light mode and lifted in dark mode to clear
  4.5:1 on both surfaces.
- **Magnific's real mark.** The hand-drawn monogram is replaced with the
  official monochrome "M" (notched top, raised inner peak), traced from
  magnific.com and used on a black tile in both themes.
- **Admin Console backend is live.** The licensing migration was applied to the
  Supabase project together with an audit log and four admin RPCs, and every
  `msap_*` function was hardened so anonymous callers cannot execute it. The
  "admin functions are not installed" setup panel is deleted; the console now
  loads real accounts, codes, stats and audit rows.
- **Studio checkerboard.** The transparency grid now follows the theme instead of
  staying bright white on a dark canvas.
- Groq's provider badge reads "Rate-limited" rather than "Free tier", matching
  what the API actually offers.

### Fixed
- Timeline-style history in the studio no longer double-restores snapshots;
  undo and redo are exact, and slider drags commit a single step on release.
- Slider and colour controls no longer swallow keyboard shortcuts while focused.
- The live preview no longer crops or stretches non-square artwork.

## [1.5.0] - 2026-11-17

### Changed
- **One flat pink identity, everywhere.** The palette is rebuilt around a single
  accent (`#c2185b` light / `#e6477c` dark) with plum as the only secondary. Every
  gradient in the app — buttons, sidebar pill, headline, logo, empty states — is
  gone; colour is now applied as flat fills. Corner radii dropped to 2–7 px so
  panels read as a desktop tool rather than a web page.
- **The logo matches the product.** The mark is a flat pink tile with the
  monogram, plus a grey `ADVANCED PRO` overline, and the favicon, PWA icons and
  Windows `.ico` were regenerated from the same geometry.
- **Freepik is now Magnific.** The marketplace name, portal URL, brand colour and
  logo are updated, and the alias still resolves existing projects. `freepik` was
  kept as the internal id so saved submissions and CSV presets keep working.
- **Platform Rules was rebuilt.** Compact cards with resolution, weight, keyword
  and title limits visible at a glance, filter chips instead of tabs, and the
  long AI/vector/CSV rules folded behind a per-agency disclosure.
- **Focused navigation.** Planner, Releases, Keyword Bank, Contact and About are
  reachable from Settings instead of the rail, so the sidebar fits on a laptop
  screen without scrolling.
- **Free AI models re-verified (17 Nov 2026).** OpenRouter `:free` variants,
  Google Gemini free-tier models and Groq's developer-plan models were checked
  against the providers' own listings; paid-only models were removed.
  Gemini 4 Hydrogen, 3.8/3.6 Flash, 3.5/3.1 Flash-Lite and Gemma 4 are listed.
- **One window, one chrome.** The renderer is frameless with an in-app
  drag region, theme toggle and window controls; macOS traffic lights get their
  own inset above the rail. The duplicated product name is gone and the app no
  longer looks like a website hosting an app.

### Added
- **Quality Checker.** Drop images, SVG, EPS or AI files for a scored report:
  vector editability (flattened raster exports, `foreignObject`, live text
  without fonts, auto-trace complexity), sharpness, exposure clipping, weight,
  near-duplicate detection via dHash against the library, and a per-agency
  pass/fail list. Exports a JSON report.
- **Image Optimizer.** Re-encodes to JPEG/WebP/AVIF/PNG with an auto quality
  sweet spot, a target-size binary search, optional long-edge downscaling and
  metadata stripping. Never returns a file larger than the original.
- **Vector Studio.** Open an SVG, draw rectangles, ellipses, stars, lines and
  text, edit fill/stroke/opacity, reorder and duplicate objects, then export
  clean SVG, a 2× PNG preview or a **real vector EPS** (PostScript emitter with
  cubic/quadratic path conversion — no raster wrapper).
- 30 logic tests covering the new quality, optimizer and EPS engines.

### Fixed
- **Admin Console no longer fails with `message_admin_status` /
  "not in the schema cache".** Failures are classified: a missing function or a
  stale PostgREST cache now shows a setup panel with the exact migration files
  and a copyable `notify pgrst, 'reload schema';`, and both migrations raise that
  notification themselves so a fresh deploy works immediately.
- **Regular accounts have no admin surface.** Verified by a browser test: no
  Admin Console or Cloud Sync entry, no admin link on Subscription, and
  `/#/admin` + `/#/cloud` render the "Administrator only" guard without any code
  generation UI.

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
