---
name: Liga16
description: Plataforma de gestión de torneos de pádel — administración de torneos y seguimiento de rankings
colors:
  primary: "hsl(16 100% 50%)"
  primary-foreground: "hsl(24 100% 8%)"
  primary-strong: "hsl(16 85% 32%)"
  secondary: "hsl(24 60% 92%)"
  secondary-foreground: "hsl(24 100% 20%)"
  muted: "hsl(24 40% 94%)"
  muted-foreground: "hsl(24 40% 36%)"
  accent: "hsl(16 100% 95%)"
  accent-foreground: "hsl(16 80% 30%)"
  success: "hsl(152 65% 32%)"
  success-foreground: "hsl(0 0% 100%)"
  warning: "hsl(38 92% 50%)"
  warning-strong: "hsl(28 87% 38%)"
  info: "hsl(200 98% 32%)"
  surface-inverse: "hsl(0 0% 8%)"
  surface-inverse-foreground: "hsl(0 0% 96%)"
  surface-inverse-border: "hsl(240 5% 18%)"
  border: "hsl(24 40% 88%)"
  input: "hsl(24 40% 88%)"
  ring: "hsl(0 0% 55%)"
  background: "hsl(0 0% 97%)"
  foreground: "hsl(24 100% 10%)"
  card: "hsl(0 0% 100%)"
  card-foreground: "hsl(24 100% 10%)"
typography:
  display:
    fontFamily: "Barlow Condensed, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(0.875rem, 2vw, 1.125rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
  stat:
    fontFamily: "Barlow Condensed, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "calc(var(--radius) + 4px)"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.primary-foreground}"
  button-destructive:
    backgroundColor: "hsl(0 72% 45%)"
    textColor: "hsl(0 0% 100%)"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    border: "1px solid {colors.border}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-link:
    textColor: "{colors.primary}"
    underline: true
  badge:
    rounded: "9999px"
    padding: "0.125rem 0.5rem"
    fontSize: "0.75rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    border: "1px solid {colors.input}"
    padding: "0.25rem 0.5rem"
    height: "2.25rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    border: "1px solid {colors.border}"
    padding: "1.5rem"
  nav-chip:
    rounded: "9999px"
    border: "1px solid {colors.border}"
    padding: "0.25rem 0.75rem"
    fontSize: "0.875rem"
  filter-pill-active:
    backgroundColor: "hsl(16 100% 32% / 0.1)"
    textColor: "{colors.primary-strong}"
    borderColor: "hsl(16 100% 50% / 0.4)"
  surface-inverse:
    backgroundColor: "{colors.surface-inverse}"
    textColor: "{colors.surface-inverse-foreground}"
    border: "1px solid {colors.surface-inverse-border}"
---

# Design System: Liga16

## 1. Overview

**Creative North Star: "The Tournament Stage"**

Every screen reads like the moments before a tournament tips off: the lights come on, the score waits to be written, and motion confirms the next state. The system treats data as live sport, not static reports — numbers settle into place rather than snap, and orange (Liga16's primary) acts as the stage lighting that spotlights what matters *now*: the live match, the active tournament, the player's ranking.

**Key Characteristics:**
- Orange primary (#ff4500) as a functional accent, never decoration
- Typography hierarchy split: Barlow Condensed for headlines/display, Inter for body/ui
- Micro-animations that confirm state (settled scores, drawn groups, captured results)
- Two tonal worlds: clean light surfaces (cards, forms) and inverted dark surfaces (heroes, match cards, stat strips)
- "póster deportivo" card treatment: dark poster surface + 3px orange stripe instead of generic Material cards

The visual system explicitly rejects the "iA app without design" aesthetic called out in PRODUCT.md: no monochrome austerity, no type-only layouts that read like unstyled Markdown. Every piece of data earns a color, a motion, or a surface treatment.

## 2. Colors

The palette is a **single-saturated-accent system**: orange primary over a neutral base — no secondary brand color to compete for attention. Neutral surfaces tilt very slightly warm (hue 24°) to harmonize with the orange, keeping the whole circuit cohesive.

### Primary
- **Liga16 Orange** (hsl(16 100% 50%), #ff4500): Used on primary actions (Button default), active state indicators, the 3px card stripe, the live "partido en vivo" badge, and score emphasis. Its rarity is the point — the eye learns to follow orange.

### Secondary
- **Warm Gray** (hsl(24 60% 92%)): Background for secondary surfaces — filter bars, selected chips, muted card backgrounds. Carries no semantic weight.

### Neutral
- **Page Background** (hsl(0 0% 97%)): Light mode page surface
- **Card Surface** (hsl(0 0% 100%)): Elevated card/background surface
- **Ink** (hsl(24 100% 10%)): Primary body text — a dark orange-tinged near-black for warmth against white
- **Muted Ink** (hsl(24 40% 36%)): Secondary text, labels, captions
- **Border** (hsl(24 40% 88%)): Form fields, card edges, dividers

### Semantic states
- **Success** (`hsl(152 65% 32%)`):Aclara un resultado, una racha, un estado pagado.
- **Warning** (`hsl(38 92% 50%)`): Rellenos y barras; `--warning-strong` (`hsl(28 87% 38%)`) es su versión de texto (el ámbar claro no llega a 4.5:1).
- **Info** (`hsl(200 98% 32%)`): Estado informativo — torneo publicado, aviso de sistema.

### Inverted (dark poster surfaces)
- **Surface Inverse** (hsl(0 0% 8%)): Hero sections, match cards, stat strips — dark in BOTH themes
- **Inverse Foreground** (hsl(0 0% 96%)): Text on dark surfaces
- **Inverse Border** (hsl(240 5% 18%)): Subtle rim on dark surfaces

### Named Rules
**The One Voice Rule.** Orange is the brand's single accent. Never introduce a second saturated color to compete with it. State, success, and warning have their own muted semantic roles — none of them is orange, none borrows its job.

**The Contrast Doctrine.** Body text must hold ≥4.5:1 against its background; the existing token comments flag this explicitly for `success` and `primary`. If a value is even close, bump the foreground color toward ink rather than accepting "elegant" gray.

## 3. Typography

**Display Font:** Barlow Condensed 800 (fallback: Inter, sans-serif) — used for section titles, numerals, stat values, and the large "16" brand mark. Slightly tight tracking at display size (-0.02em); it is a wide face, so it is not squeezed further.

> **En prueba.** La display anterior era Anton (condensada, muy pesada, "cartel de gimnasio"). Se cambió a Barlow Condensed: geométrica, abierta y con la misma condensación, para que el "16", los avatales de una letra y los titulares cortos sigan cabiendo. La prueba vive en un solo sitio (el titular del hero de la home, token `poster`); cuando se apruebe, `display` y `headline` en `tailwind.config.js` pasan a apuntar aquí y Anton sale del proyecto.

**Body Font:** Inter (fallback: system-ui, ui-sans-serif) — used for all UI text, tables, forms, and body copy.

**Character:** The pairing contrasts a condensed display with a readable humanist workhorse. The display face is never used for UI labels or data; Inter is never used for display headlines. Three weights maximum (400/600/700) across the system.

### Hierarchy
- **Display** (700, clamp(0.875rem, 2vw, 1.125rem) — used for the home h1 at 4rem): Hero and section mastheads
- **Headline** (700, 1.5–2.25rem): Section headings, tournament names
- **Body** (400, 1rem, 1.5): Standard text, table rows
- **Label** (600, 0.75rem, 0.08em tracking, uppercase): Stat row labels, badges, captions — `text-caption` token
- **Stat / Numeral** (700, 1.125rem, -0.02em, tabular-nums): The "cifras" strip and hero numerals — `text-stat` token

### Named Rules
**The One-Type Rule.** Inter carries all UI. No font is added for "just one screen."

**The Numeral Rule.** Tournament scores, live counts, and ranking positions use tabular-nums (`font-variant-numeric: tabular-nums`) so columns don't re-flow as digits change.

## 4. Elevation

**Surface-based, not shadow-based.** Depth comes from tonal layering and borders, not cast shadows. Cards sit flat on their surface color with a 1px border; the inverted poster surfaces (hero, match card) are dark and self-evidently elevated.

### Shadow Vocabulary
- None on cards at rest.
- **Lift Hover** (`0 0 0 1px hsl(var(--primary) / 0.18), 0 10px 24px -12px hsl(var(--primary) / 0.35), 0 4px 8px -6px hsl(0 0% 0% / 0.35)`): Only on interactive cards (`.liga16-card--lift`), with the top-left 3px orange stripe as the hover cue. Never applied to static containers.

### Named Rules
**The Flat-At-Rest Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, focus), and only on interactive elements.

## 5. Components

### Buttons
- **Shape:** `8px` radius (`rounded-md`) on all button variants — consistent vocabulary
- **Primary:** Orange fill (`hsl(16 100% 50%)`), dark foreground (`hsl(24 100% 8%)`), on hover shifts to `hsl(16 85% 32%)` (orange deepens)
- **Ghost:** Transparent, text-muted on hover, for secondary actions
- **Outline:** Border + transparent, for tertiary actions
- **Icon (circular):** `9999px` radius, for compact action targets

### Chips / Filter Pills
- **Shape:** `9999px` (pill)
- **Active state:** Orange tint background `hsl(16 100% 32% / 0.1)`, `hsl(16 100% 50% / 0.4)` border, strong orange text — selected state reads immediately
- **Inactive:** Border + muted text; hover lifts to hover-muted background
- Rendered as a **horizontal scrollable bar** (not a `<Select>` dropdown) so the full option set is visible; the bar auto-hides when there's nothing to filter

### Cards
- **Surface treatment:** `.liga16-surface` base (clean light or inverted dark) with 1px border; `.liga16-surface--poster` for hero/match cards (dark in both themes)
- **Stripe:** `.liga16-stripe` — 3px absolute top bar at `hsl(16 100% 50%)`; the primary visual cue for "this is Liga16"
- **Numeral:** `.liga16-numeral` — oversized display face at 16 opacity, the decorative "16" brand mark
- **Lift hover:** `.liga16-card--lift` — raises 2px, orange-tints the border, adds the hover shadow above. Never on static containers
- **Corner radius:** `10px` (`var(--radius)`) — never over-rounded

### Stat Row
- **`.liga16-statrow`** — grid of labeled values (the "cifras" strip on heroes): value in `hsl(16 100% 85%) / display face / tabular-nums`, label in uppercase `text-caption` / muted
- Bordered by top + inline separators in `hsl(24 40% 88% / 0.5)`
- **Purpose:** makes tournament stats (Parejas, Torneos, Categorías) scannable at a glance

### Pair Avatar
- **`.liga16-pair`** — circular badge `9999px`, orange-tint background `hsl(16 100% 50% / 0.14)`, strong orange text. Fallback when a team has no crest image

### Inputs / Fields
- **Shape:** `8px` radius
- **Border:** `1px solid hsl(24 40% 88%)`
- **Focus:** Border darkens to `hsl(24 100% 40%)` — no colored ring, no shadow glow. The brand orange is reserved for primary actions
- **Autofill:** Background painted with `hsl(var(--background))` to override browser yellow/orange autofill

### Navigation
- Filter/navigation as **button-bar pills** (FilterNav) — `aria-current` on active, `9999px` radius, minimum `32px` touch height — never a dropdown on mobile
- Section headings include an eyebrow (uppercase tracking) + title + inline action link (ghost button "Ver todos")

## 6. Do's and Don'ts

### Do:
- **Do** use orange as a functional accent only — on primary actions, live state, the card stripe, and score emphasis. Keep it rare so it reads.
- **Do** render stat values in the display face with `tabular-nums` so columns hold alignment.
- **Do** present active filter state on chips with the `hsl(16 100% 32% / 0.1)` background — instantly scannable.
- **Do** treat hero/match surfaces as dark poster cards (`--surface-inverse`) regardless of theme for consistent branding.
- **Do** keep card corners at 10px and button corners at 8px — consistent vocabulary.

### Don't:
- **Don't** pair a 1px border with a wide drop shadow on the same element (the ghost-card pattern from PRODUCT.md anti-references). Pick one.
- **Don't** over-round cards/sections to 32px+ or 40px — the brand caps at 10px.
- **Don't** use gradient text (`background-clip: text` with a gradient). Emphasize via weight or size only.
- **Don't** use side-stripe borders on cards or list items — use the full-width 3px `--primary` stripe as the brand's stripe language.
- **Don't** use decorative grid backgrounds (`linear-gradient 1px` overlays) on non-canvas surfaces.
- **Don't** ship display text letter-spacing tighter than -0.04em (capsized letters at display sizes).
- **Don't** make micro-animations that gate content visibility on class triggers (reveals that don't fire on hidden tabs ship blank content).
