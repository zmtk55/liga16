# Product

## Register

brand

## Platform

web

## Users

Primary audience: circuit operators and tournament admins who manage one or many pádel tournaments end-to-end on Liga16. They need full control without effort — create tournaments, set up courts, draw groups, capture match scores, and update rankings in as few steps as possible.

Secondary audience: players, clubs, and fans who want to view schedules, live scores, and ranking statistics in an easy, professional way and compare themselves against the leaderboard. The platform must feel credible in this read-only surface; it is the proof the system works.

A surface-vs-user split applies: the same product presents distinct faces to admins (control surface) and players (consumption surface). Both must feel like Liga16, but the affordances diverge — dense creation tooling for admins, scannable results for players.

## Product Purpose

Liga16 exists to make running pádel tournaments friction-free for organizers and to make following your scores and ranking frictionless for players. For admins, success means a tournament goes from idea to "jugable" (playable) without gaps and with as little configuration overhead as possible; for players, success means reaching their schedule and ranking in one tap and trusting the numbers they see.

## Positioning

Liga16 is the tournament management platform that makes running one or several tournaments effortless for admins, and delivers clean, professional scores and rankings for players — so organizers keep control and players keep coming back to check themselves.

## Conversion & proof

- Primary CTA: "Ver horarios y estadísticas de ranking" — the first action a player takes to see their schedule and ranking stats.
- Secondary fallback: "Ver estadísticas de equipo" — for visitors not ready to sign in; the platform must look professionally credible enough that a hesitant visitor trusts it.
- The line a visitor should remember after 10 seconds: _(TBD — user flagged not yet defined)_

**Belief ladder** (what the visitor must believe, in order, before the primary CTA):
1. Everything on Liga16 is effortless — no complex setup.
2. Getting started is fast (an onboarding that doesn't feel like registration friction).
3. I can come back any time and instantly see my schedule and ranking again — my data persists.
4. The platform is professional and trustworthy; the numbers are reliable.
5. My player dashboard and my team's dashboard keep my progress in one readable place.

- Proof on hand: none supplied yet. A `.impeccable/assets/proof/` directory will be created on demand when testimonials, case studies, press, or partner logos are available.

## Brand Personality

Voice/tone: confident-metrics, precise, alive-with-detail. Three words: **preciso, ágil, profesional**.

The brand carries rigor through metrics and visual precision — numbers don't just appear, they settle into place. Micro-animations are the signature gesture: subtle motion that confirms an action, surfaces a state change, or guides the eye to a new stat. It is never decorative for its own sake; every micro-interaction earns its place by making a measurement scannable.

## Anti-references

- The classic iA-style "product without design" aesthetic — monochromatic, spare to the point of feeling unfinished, type-only layouts that look like they could have been written in Markdown. Liga16 is intentionally not this; the brand's rigor is expressed through motion and metrics, not austerity.
- Generic SaaS dashboards that bury metrics under layers of cards and muted grayscale.
- Any surface that looks like it was assembled from a template — identical card grids, cookie-cutter hero-metrics, and eyebrow-led sections.

## Design Principles

1. **Effortless control** — admin surfaces never require extra clicks to complete the core task; the primary workflow stays on the primary path.
2. **Fast return** — players reach their schedule and ranking in one tap from entry; re-engagement beats re-registration.
3. **Professional clarity** — stats and rankings read clean and trustworthy at a glance; no metric fights for attention.
4. **Micro-momentum** — motion and metrics are the brand signature; use them to surface progress and confirm actions, never as decoration.
5. **No-friction onboarding** — first-time setup and re-access never feel like registration friction; the system assumes good intent and adapts.

## Accessibility & Inclusion

- Target: WCAG 2.1 AA.
- The product must be usable across ages — from a child following scores to a 45-year-old organizing a tournament — with nothing more complicated than necessary.
- Reduced motion is honored globally (already wired in `src/index.css` via `@media (prefers-reduced-motion: reduce)`): all animations collapse to instant state.
- Color is never the only carrier of meaning — accent (Liga16 orange) supports state, it does not define it.
- Body text contrast must hold ≥4.5:1 against its background; the existing token comments already flag this as a deliberate constraint.
