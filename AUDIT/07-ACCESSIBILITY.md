# 07 — Accessibility

Static review against WCAG 2.2 AA. No screen-reader or automated axe run was performed —
the in-app browser blocked the site's stylesheets and scripts, so rendered-DOM testing was
**NOT POSSIBLE IN THIS ENVIRONMENT**. Findings below are from source, and each names how to
verify it.

## What is already right

Worth stating first, because the marketing site's semantics are better than most:

- Correct landmarks: `<header className="site-header">`, `<nav aria-label="Primary">`,
  `<nav aria-label="Breadcrumb">`, `<main>`, `<footer>`, one per page.
- Heading hierarchy is enforced by construction — `SeoPage` emits exactly one `<h1>` from
  `meta.h1`, every `Section` is an `<h2>`, service cards are `<h3>`. Verified live: one
  `<h1>` on a blog post.
- `aria-current="page"` on the terminal breadcrumb.
- **Tap targets:** `.btn { min-height: 44px }` (`globals.css:97`) meets WCAG 2.5.8. The
  mobile sticky bar overrides to `min-height: 0`, but computes to ~46 px
  (`--sticky-h: 64px` less `2 × 0.55rem` padding), so it still passes. Checked specifically
  because the override looked wrong.
- `prefers-reduced-motion: reduce` handled in both `globals.css:283` and `home.css:791`,
  disabling transitions, transforms and animations.
- Focus styles present in `globals.css`, `home.css` and `blog.css`.
- `img { max-width: 100%; height: auto }` globally; all images carry explicit dimensions and
  meaningful `alt` (or `alt=""` where decorative — correctly applied on the blog cards).
- FAQs use native `<details>`/`<summary>` — keyboard-operable and screen-reader-announced
  with no ARIA at all. Exactly the right choice.
- Tables are wrapped in `.table-wrap { overflow-x: auto }` so wide data scrolls in its own
  container rather than breaking the page.
- `<html lang="en-IN">`.

---

## [FIN-A01] The home page's DOM order does not match its visual order

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Accessibility (WCAG 1.3.2 Meaningful Sequence, 2.4.3 Focus Order)

**Location:** `next-app/app/page.tsx:111,127-173`; layout rules in `styles/home.css` under `.home`

`HomePage` passes a stripped `shell` model to `SeoPage` and then passes its hero pieces as
`children`. `SeoPage` renders children **inside `<main>`**, after the `<header className="hero">`
that holds the `<h1>`, tagline, badges and CTAs. So the DOM order is:

```
nav.crumbs → header.hero (h1, tagline, badges, CTA row)
           → main (home-eyebrow, home-anchor, home-visual, home-stats, about, services, …)
```

The file's own comment says the `.home` CSS grid places these "around SeoPage's h1 (DOM order
untouched)". That is precisely the problem: sighted users see eyebrow → h1 → anchor price →
visual; keyboard and screen-reader users get h1 → CTAs → eyebrow → price → image.

**Why it matters.** The "Starting at ₹4,999 one-time fee · monthly salary paid directly to
the helper" line is the single most important qualifying statement on the page — it is what
stops a visitor thinking ₹4,999 buys a maid. A screen-reader user encounters it *after* the
"WhatsApp us / Call / Book in the app" CTAs, i.e. after the point of decision. Focus order
has the same inversion.

**How to verify:** tab through https://mybuddymaid.in/ and compare the focus ring's path to
the visual layout; or run axe DevTools and check the reading order.

**Fix — the smallest safe one.** Give `SeoPage` an optional `heroChildren` prop rendered
inside `<header className="hero">` before `<CtaButtons>`, and move `home-eyebrow`,
`home-anchor` and `home-visual` into it. The grid then no longer needs to reorder them, and
DOM order becomes the visual order. Roughly 15 lines across two files, no visual change.

---

## [FIN-A02] Three non-functional controls in the booking app header

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Accessibility / UX

**Location:** `app/src/components/AppLayout.jsx:36-40, 57-60, 64-67`

```jsx
<div className="sidebar-search-trigger"> <Search/> <span>Quick find...</span> <kbd>⌘K</kbd> </div>
<button className="app-header-location"> <MapPin/> <span>{profile?.city || 'Delhi'}</span> </button>
<button className="app-header-btn"> <Bell/> <span className="notification-dot" /> </button>
```

None has an `onClick`. Specific failures:

- The **bell** renders a permanent unread-notification dot. There is no notification system
  anywhere in the product. It signals "you have something waiting" to every user, forever,
  and clicking does nothing.
- The **location button** is a real `<button>` in the tab order with no action and no
  accessible description of what activating it would do (WCAG 4.1.2 Name, Role, Value).
- The **"Quick find… ⌘K"** element is a `<div>` styled as a search input. It advertises a
  keyboard shortcut that is not bound. Not focusable, so it is invisible to keyboard users
  while looking interactive to everyone else.

**Fix:** delete all three. They are aspirational UI for features that do not exist, and
each one teaches users that this app's controls do not respond. If the city selector is
wanted, wire it to `profiles.city`; that is a small, real feature.

---

## [FIN-A03] Modals and sheets in the booking app are not accessible dialogs

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Accessibility (WCAG 2.1.2, 2.4.3, 4.1.2)

**Location:**
`app/src/pages/PricingPage.jsx:160-210` (purchases-paused modal)
`app/src/pages/ServiceDetailPage.jsx:114-181` (booking sheet)
`app/src/pages/ServiceDetailPage.jsx:194-224` (support popup)

All three are plain `<div>` overlays. None has `role="dialog"`, `aria-modal="true"`, or
`aria-labelledby`. None traps focus, none moves focus into the dialog on open, none restores
focus to the trigger on close, and none closes on `Escape`.

Consequences:
- A screen-reader user is never told a dialog opened; the page content behind it stays in the
  accessibility tree and is fully reachable by virtual cursor.
- A keyboard user can tab straight out of the "booking" sheet into the page behind it and
  interact with content they cannot see.
- `Escape` does nothing anywhere.

The booking sheet is the app's only conversion action, so this is not a corner case.

**Fix:** the smallest correct change is to use the platform. Replace each overlay `<div>`
with `<dialog>` and call `showModal()` — the browser then provides focus trapping, focus
restoration, `Escape` handling and inert background for free:

```jsx
const ref = useRef(null);
useEffect(() => { showBookingForm ? ref.current?.showModal() : ref.current?.close(); }, [showBookingForm]);
return (
  <dialog ref={ref} className="booking-sheet" aria-labelledby="booking-title"
          onClose={() => setShowBookingForm(false)}>
    <h3 id="booking-title">Book {service.name}</h3>
    ...
  </dialog>
);
```
`<dialog>` is supported in every browser this product targets. If a custom overlay is
required for styling, add `role="dialog" aria-modal="true" aria-labelledby`, an `Escape`
handler, and a focus trap.

---

## [FIN-A04] The mobile nav toggle has no expanded state and a misplaced label

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Accessibility (WCAG 4.1.2)

**Location:** `next-app/components/shared/Header.tsx:16-20`

```tsx
<input type="checkbox" id="nav-toggle" className="nav-toggle__input" aria-label="Menu" />
<label htmlFor="nav-toggle" className="nav-toggle__btn">Menu</label>
```

The CSS-only pattern is a deliberate and good choice — it keeps the nav links in the
server-rendered HTML (they carry site-wide internal linking) with zero JavaScript, and the
comment explains why `<details>` was rejected. Two refinements:

- `aria-label="Menu"` on the checkbox duplicates the visible `<label>` text, which is what a
  screen reader will announce anyway. It is redundant, and it means the control announces as
  "Menu checkbox" rather than as a menu button.
- There is no `aria-expanded`, so state is not conveyed. A pure-CSS toggle cannot set it
  without JS.

**Fix (no JS):** drop the redundant `aria-label`, and add `aria-hidden="true"` plus
`tabIndex={-1}` to the checkbox while making the `<label>` the focusable control with
`role="button"` and `tabIndex={0}`. This is imperfect — the honest alternative, if
`aria-expanded` matters to you, is ~10 lines of JS in a small client component. Given the
nav links are always present in the DOM and reachable at desktop widths without the toggle,
the current state is a minor issue, not a blocker.

---

## [FIN-A05] No skip-to-content link

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Accessibility (WCAG 2.4.1 Bypass Blocks)

**Location:** `next-app/app/layout.tsx:38-45`

Every page begins with the header (brand + 7 nav links) and a breadcrumb before `<main>`. A
keyboard user tabs through 8+ links on every page before reaching content. There is no skip
link.

**Fix:** four lines in the layout, plus one CSS rule.
```tsx
<a href="#main" className="skip-link">Skip to content</a>
```
```css
.skip-link { position: absolute; left: -9999px; }
.skip-link:focus { left: 1rem; top: 1rem; z-index: 100; /* visible styling */ }
```
and add `id="main"` to the `<main>` element in `SeoPage`, `TrustPage`, `blog/page.tsx` and
`blog/[slug]/page.tsx`.

---

## [FIN-A06] Colour contrast — NOT VERIFIED

**Severity:** unknown · **Confidence:** NEEDS VERIFICATION · **Category:** Accessibility (WCAG 1.4.3)

Contrast could not be computed without rendering the site. Two combinations look worth
checking from the source values:

- `.site-footer a { color: #cbd5e1 }` on `--obsidian` — likely passes, but
  `.site-footer__note { opacity: 0.6 }` on the same background reduces effective contrast to
  roughly 2.8:1, which would **fail** 4.5:1 for body text. `globals.css:255-256`.
- `.btn-whatsapp { background: var(--whatsapp) /* #25D366 */; color: #062b12 }` — dark on
  bright green, almost certainly passes; confirm.
- `.muted` and `.pricing-card-period`-style secondary text throughout.

**How to verify:** axe DevTools or Lighthouse on `/`, `/delhi/dwarka`, `/blog`. This is a
10-minute check and should be done before any contrast changes are made.

---

## Booking-app accessibility, generally

The SPA is weaker than the marketing site and was clearly built visually first:

- Form inputs use `<label>` elements containing an icon and text with the input as a sibling,
  not wrapped or associated by `htmlFor`/`id`. In `ServiceDetailPage.jsx:128-171` and
  `ProfilePage.jsx:84-104` the label and input are siblings inside a `div`, so **the
  association is not programmatic** — a screen reader announces an unlabelled text field.
  This affects every field in the app. Fix by adding `htmlFor`/`id` pairs or nesting the
  input inside the `<label>`.
- Error messages (`booking-error`, `onboarding-error`, `pricing-field-error`) are rendered as
  plain `<p>` with no `role="alert"` and no `aria-describedby` link to the field, so they are
  never announced.
- `AuthPage` sign-in and sign-up are `<div className="auth-form">` with `type="button"`
  handlers rather than `<form onSubmit>`. `Enter` works only because of explicit `onKeyDown`
  handlers on the password field; pressing `Enter` in the email field does nothing. Wrapping
  both in `<form onSubmit>` fixes submission, browser password-manager integration and
  keyboard behaviour in one change.
- The app is dark-only (`#0F0F0F`) with no `prefers-color-scheme` handling and heavy inline
  styles, making a future theme or contrast fix expensive.

**Priority within the SPA:** fix the form-label associations first (one mechanical pass,
affects every screen), then the dialogs (FIN-A03), then the phantom controls (FIN-A02).
