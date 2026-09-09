# Legal pages: layout and interaction spec

Version: design specification accompanying the 2.0 drafts
Effective date: not applicable
Supersedes: the TrustPage rendering of /privacy-policy and /terms-of-service shipped in Phase 1a, which remains the fallback

## At a glance

- One page component, `LegalPage`, sits beside `TrustPage` and renders either document from structured content, so the table of contents, the quick anchors, the summaries and the search index are all derived from the same data.
- Desktop is a split screen: a sticky 300-pixel contents rail on the left with search, four quick anchors and a scroll-spy list; the document on the right at 68 characters measure. Mobile collapses the rail into a Contents sheet opened from a fixed button.
- Every major section opens with a plain-English summary card; critical numbers sit in callouts with a fixed visual grammar: amber for a warning, rose for a critical obligation, slate for a note.
- The document body is set in a serif at 17 pixels and 1.7 line height, the interface in Inter; the palette is the brand's own obsidian, mint and emerald with cool greys, and semantic colours are reserved for warnings.
- The whole thing is progressively enhanced: the page reads and links correctly with no JavaScript, and one small inline script adds scroll-spy, search, the document toggle and the contents sheet, matching the site's near-zero-JavaScript policy.

## 1. Information architecture {#ia}

> **Summary:** The reader's job is to find one clause and trust what it says. The layout puts a map of the document beside the document, keeps the map in sync with scrolling, and gives the four questions people actually arrive with their own buttons.

### 1.1 Sticky split-screen navigation

- **Breakpoints.** At 1024 pixels and above the page is a two-column grid: a 300-pixel contents rail and a content column of `minmax(0, 1fr)`, with a 48-pixel gap, inside the site's 1120-pixel maximum. Between 768 and 1023 pixels the rail collapses and the Contents button appears. Below 768 pixels the same, with the document at full width and 20-pixel side padding.
- **The rail is sticky**, offset by the header height plus the version banner (`top: calc(var(--header-h) + var(--banner-h) + 16px)`), and scrolls internally if the list is taller than the viewport, so the search field never leaves the screen.
- **Scroll-spy.** An `IntersectionObserver` watches every `h2` in the active document with a root margin of `-40% 0px -55% 0px`, so the section whose heading is in the upper part of the viewport is the current one. The current item gets `aria-current="true"`, a filled marker and the emerald text colour; the rail scrolls the current item into view if it is hidden. A hairline progress bar under the version banner shows how far through the document the reader is, computed from the document's own height, not the page's.
- **Section numbering is real.** Legal sections are numbered by convention and readers cite them ("clause 7.3"), so the rail shows the numbers and the headings carry them. Nothing else on the page uses decorative numbering.
- **Stable anchors.** Every section has an id fixed in the content data (`#refunds`, `#liability`), not generated from the heading text, so links survive a retitle. Hovering a heading reveals a link icon that copies the clause URL.

### 1.2 High-value quick anchors

- Four pill buttons sit at the top of the rail, above the numbered list, and are repeated at the top of the mobile Contents sheet: **Refunds**, **Cancellations**, **Payments**, **Liability**. On the Privacy Policy the same slot holds **Your rights**, **What we collect**, **Who we share with**, **Delete my data**.
- They are the only elements in the rail rendered as filled pills, so the eye lands on them first. Each targets a section id, updates the URL hash, and moves keyboard focus to the section heading so screen-reader users land in the right place.
- The quick-anchor set is part of the content data, one array per document, so a future document (a refund-policy page, a cookie policy) gets its own four without a code change.

## 2. Visual hierarchy and componentisation {#hierarchy}

> **Summary:** Three reusable objects do all the work: the summary card that opens a section, the callout that isolates a number the reader must not miss, and the clause paragraph with its number set in the margin.

### 2.1 Summary cards ("In plain English")

- Every major section begins with an `aside` labelled by an uppercase eyebrow, **In plain English**, followed by two to four sentences in the site's body face at 16 pixels. The card uses the brand's mint-subtle fill (`rgba(52, 211, 153, 0.08)`) with a 1-pixel `--line` border and the site's 14-pixel radius; no shadow and no left rail, so it reads as a note on the page rather than a separate object competing with the callouts.
- The summary is written for the reader, not as a paraphrase of the clause: what the section means for them, in the second person, with the numbers that matter. It is content in its own right and is part of the document data, so it is searchable and appears in print.
- The document also opens with an **At a glance** card: five to seven bullets covering the whole document, in the same style, placed under the title and above the first section.

### 2.2 Callout and warning blocks

| Level | When | Fill and text (light) | Border | Icon |
|---|---|---|---|---|
| Note | Context, cross-references, "this number comes from the pricing data" | `#f1f5f9` fill, `#334155` text | 1px `#94a3b8` | Information circle |
| Warning | An obligation with a consequence: the non-solicitation restriction, chargebacks, safety withdrawal | `#fffbeb` fill, `#92400e` text | 1.5px `#f59e0b`, left edge 4px | Triangle |
| Critical | A number that governs money: the 14-Business-Day refund initiation window, the ₹5,000 liability cap, the ₹21,000 liquidated-damages figure | `#fff1f2` fill, `#9f1239` text | 2px `#e11d48`, left edge 4px | Exclamation octagon |

- Callouts use the semantic colours only. The brand accent never appears inside a callout, so mint always means "the brand or a link" and amber or rose always means "read this".
- Icons are inline SVG at 20 pixels, set in the text colour of the block, with the level spoken to screen readers through a visually hidden label ("Warning:").
- In the dark theme the fills become 10-percent tints of the border colour and the text lightens to the 300-weight of each hue (`#fcd34d`, `#fda4af`, `#cbd5e1`), keeping contrast above 7:1 in both themes.
- Rule of restraint: no more than one Critical block per section and no Warning inside a summary card. A callout is an exception; a page of exceptions has none.

### 2.3 Typography matrix

| Role | Face | Size and line height (desktop) | Size and line height (mobile) | Notes |
|---|---|---|---|---|
| Document title | Inter 800 | 34px / 1.15, letter-spacing -0.02em | 28px / 1.15 | `text-wrap: balance` |
| Section heading (h2) | Inter 800 | 24px / 1.2 | 22px / 1.2 | Number set with `tabular-nums` |
| Subsection (h3) | Inter 700 | 19px / 1.3 | 18px / 1.3 | |
| Clause body | Source Serif 4, 400 | 17px / 1.7, measure 68ch | 16px / 1.65 | Optical size axis at 17 |
| Summary card | Inter 400 | 16px / 1.6 | 15px / 1.6 | |
| Eyebrow labels | Inter 700, uppercase | 11px, letter-spacing 0.08em | 11px | |
| Rail items | Inter 500 | 14px / 1.4 | 15px / 1.5 in the sheet, 44px targets | |
| Tables and figures | Inter 400 | 15px / 1.5, `tabular-nums` | 14px, horizontal scroll in `.table-wrap` | |
| Captions and meta | Inter 400 | 13px / 1.5 | 13px | Never below 13px |

- **Contrast.** Body `#111827` on `#ffffff` is 17.4:1; secondary `#374151` is 10.3:1; muted `#6b7280` is 4.8:1 and is used only at 14 pixels and above; link `#047857` is 5.5:1; dark-theme body `#e5e7eb` on `#0d1117` is 15.6:1; the mint accent `#34d399` on obsidian is 9.7:1 and is never used as text on white, where it fails at 1.9:1.
- **Why a serif for the clauses.** Long-form legal text is read line by line and referred back to; a serif with a true optical size at 17 pixels holds a 68-character line better than Inter does, and it signals "document" against the site's marketing pages without changing the brand voice, because every heading, label and control stays in Inter. The serif is loaded only on the two legal routes, so the site's font budget is unchanged elsewhere. If the extra 30 kilobytes are unwelcome, the matrix works with Inter throughout at 17px / 1.75.

## 3. Interactive and micro-experience elements {#interactive}

> **Summary:** Four behaviours, one small script: search that highlights as you type, a two-way document toggle that does not reload, a contents sheet on mobile, and a version banner with the archive behind it. No framework, no dependency.

### 3.1 In-document search

- A search field sits at the top of the rail (and of the mobile sheet) with `role="search"`, a placeholder of "Search this document", and a live count ("7 matches") announced through `aria-live="polite"`.
- Typing two or more characters walks the text nodes of the active document only, wraps each case-insensitive match in `<mark>`, and scrolls the first match into view. Enter and the Next and Previous buttons step through matches; Escape clears. Matching is debounced at 150 milliseconds and never touches the rail or the other document, so it stays instant on a 40-page document.
- Marks use `#fde68a` on the body text colour in the light theme and `#854d0e` with `#fef3c7` text in the dark theme; the current match gets a 2-pixel outline in the accent colour.

### 3.2 Segmented toggle between the two documents

- A two-segment control, `role="tablist"`, sits between the version banner and the split layout: **Terms of Service** and **Privacy Policy**. Both documents are pre-rendered in the page; the toggle switches the visible article, swaps the rail's list and quick anchors, updates the version banner, and rewrites the URL to the document's own path with `history.pushState`, so the browser's back button and the address bar behave as if the user had navigated.
- Each document keeps its canonical URL (`/terms-of-service`, `/privacy-policy`) and its own metadata; the route renders the same component with the active document set from the path and the other document included but hidden, which keeps both statically generated and keeps the toggle instant. The document `<title>` and the canonical link are updated on toggle.
- Keyboard: arrow keys move between segments, Home and End jump, and the active segment carries `aria-selected="true"`. The in-app terms screen in the booking app is replaced by a link to this page so that there is one rendering of the agreement.

### 3.3 Contents sheet on mobile

- Below 1024 pixels a fixed button, **Contents**, sits bottom-right above the safe-area inset. It opens a native `<dialog>` as a bottom sheet holding the search field, the quick anchors and the numbered list, with 44-pixel targets. Choosing a section closes the sheet and scrolls to the heading; focus moves to the heading.

### 3.4 Version-control banner

- Directly under the site header, full width, on the obsidian ground: the document name, **Version 2.0**, **Effective [date]**, **Last updated [date]**, and two text buttons, **Previous versions** and **What changed**.
- **Previous versions** opens a dialog listing every published version with its effective date and a link to the archived rendering at `/legal/archive/terms-of-service/v1.1`, generated from the same content data with the historical text frozen at publish time. **What changed** opens a short human-written changelog for the current version, which also satisfies the 15-day change notice in the Terms.
- The banner is the only place the brand's obsidian ground is used on the page, so it reads as the page's chrome rather than as content.

## 4. Corporate trust and aesthetic guidelines {#trust}

> **Summary:** The brand already owns a calm palette: obsidian, mint, emerald and cool greys. The legal pages use it as-is and add only the three semantic colours for warnings. Whitespace does the rest.

### 4.1 Palette

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#f8fafc` | `#0d1117` | Page ground |
| `--surface` | `#ffffff` | `#161b25` | Rail, cards, tables |
| `--ink` / `--ink-2` | `#111827` / `#374151` | `#e5e7eb` / `#cbd5e1` | Text |
| `--line` | `#e5e7eb` | `rgba(255,255,255,0.10)` | Hairlines |
| `--accent` / `--accent-strong` | `#059669` / `#047857` | `#34d399` / `#6ee7b7` | Links, current section, focus rings |
| `--accent-subtle` | `rgba(52,211,153,0.08)` | `rgba(52,211,153,0.08)` | Summary-card fill |
| Warning | `#92400e` on `#fffbeb`, border `#f59e0b` | `#fcd34d` on 10% amber | Obligations with consequences |
| Critical | `#9f1239` on `#fff1f2`, border `#e11d48` | `#fda4af` on 10% rose | Governing numbers |
| Note | `#334155` on `#f1f5f9`, border `#94a3b8` | `#cbd5e1` on 10% slate | Context |

- Emerald, not mint, carries text and interactive states on light grounds; mint is reserved for marks on the obsidian banner and for the dark theme. No gradients, no red except in the Critical block, no colour used for decoration.

### 4.2 Whitespace and rhythm

- Sections are separated by 56 pixels on desktop and 40 on mobile, with `scroll-margin-top` equal to the sticky chrome so anchored headings are never hidden behind it.
- Paragraph spacing is 1.1em; list items 0.4em; a summary card has 20-pixel padding and 24 pixels below it; callouts have 16 by 20 pixel padding and 24 pixels above and below; tables sit in a scrolling wrapper with 24 pixels above and below and 12 by 14 pixel cell padding.
- The content column never exceeds 68 characters for running text. Tables and the annexures may extend to the column's full width and scroll horizontally inside their wrapper; the page itself never scrolls sideways.
- Clause numbers hang in a 3.25em left gutter on desktop so the text edge stays straight and a reader can run an eye down the numbers; on mobile they are inline and bold.

### 4.3 Accessibility, print and motion

- A skip link to the document, visible focus rings in the accent colour on every control, `aria-current` in the rail, `aria-selected` on the toggle, labelled dialogs, and 44-pixel targets on mobile.
- A print stylesheet hides the chrome, the rail and the inactive document, prints summary cards and callouts with their borders, expands link URLs in the annexures, and starts each numbered section on a new page where it is long. People print legal pages; it should look intended.
- Smooth scrolling and the sheet's slide-up respect `prefers-reduced-motion`. There is no other motion on the page.

## 5. Implementation notes for this codebase {#implementation}

> **Summary:** A `LegalPage` component and a content module per document; the numbers come from `plans.ts`; one inline script; no new dependency.

- **Content as data.** `data/legal/terms-of-service.ts` and `data/legal/privacy-policy.ts` export `{ id, version, effectiveDate, updatedAt, atAGlance, quickAnchors, sections: [{ id, number, title, summary, level, body }] }`. Body content is authored as the constrained Markdown used for these drafts and converted at build time, exactly as the blog pipeline already does for posts. Plan fees, terms, counts and the refund constants are interpolated from `data/seo/plans.ts`, which closes FIN-C01.
- **Component.** `components/seo/LegalPage.tsx` renders the banner, the toggle, the rail and the article from that data and emits `BreadcrumbList` JSON-LD as `TrustPage` does. Both routes render it with `activeDocument` set from the path. The inline script is a sibling of the analytics bootstrap: a few kilobytes, no framework, attached with `next/script` after interaction.
- **Styles.** One stylesheet, `styles/legal.css`, imported by the two routes only, using the tokens already declared in `globals.css` and adding the semantic ones above. The serif is loaded through `next/font/google` in the same two routes.
- **Archive.** `app/legal/archive/[doc]/[version]/page.tsx` renders frozen copies of earlier versions from `data/legal/archive/`, generated statically. The `versions` list in each document's data drives both the banner dialog and the archive routes.
- **Booking app.** `app/src/pages/TermsPage.jsx` becomes a single screen that links to the canonical pages, so the agreement exists in one place.
- **Tests.** The existing stylesheet invariant and sitemap tests cover the new routes without change; add one data-driven assertion that every quick anchor resolves to a section id in its document, and one that the plan numbers in the rendered terms equal those in `plans.ts`.
