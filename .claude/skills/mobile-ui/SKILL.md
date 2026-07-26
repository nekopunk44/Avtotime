---
name: mobile-ui
description: Design system and patterns for building distinctive, premium Avtotime mobile UI (React Native / Expo). Use whenever creating, restyling, or reviewing any mobile screen or component so the app looks intentionally designed and on-brand, not generated.
---

# Avtotime mobile design system

Goal: the app should feel like a **premium automotive product** — confident,
high-contrast, motion-rich — not a generic CRUD form. Import tokens from
`mobile/src/theme.ts` (`colors`, `space`, `radius`, `font`, `shadow`). Never
hard-code hex/paddings that duplicate a token.

## Design language
- **Automotive & premium**: black/ink + white, one **electric-blue accent**
  (`colors.accent`) used deliberately for active/primary things only.
- **Depth over borders**: cards use `shadow.card`, radius `radius.lg`, and
  `colors.surface` on a `colors.bg` page. Avoid 1px gray borders everywhere.
- **Bold hierarchy**: big confident titles (`font.h1`/`display`, weight `900`),
  quiet muted metadata (`colors.textMuted`, weight `600`). Generous whitespace.
- **Imagery leads**: photos/thumbs are large, full-bleed, `radius.lg`; text
  supports them. Market/feed cards are visual-first.

## Component recipes
- **Primary button**: height 52, `radius.pill` or `radius.lg`, bg `colors.ink`
  (or `colors.accent` for the key CTA), white 900 text, press-scale 0.97.
- **Secondary/chip**: bg `colors.surfaceAlt`, no border, `radius.pill`, muted
  text; active chip → bg `colors.accent`, white text.
- **Card**: `colors.surface`, `radius.lg`, `shadow.card`, padding `space.lg`,
  NO border. Group related cards with `space.md` gaps on `colors.bg`.
- **Input**: filled `colors.surfaceAlt`, `radius.md`, no hard border; focus →
  border `colors.accent`. Placeholder `colors.textFaint`.
- **Section header**: small caps-ish label `font.small` weight 900
  `colors.textMuted`, with an optional accent "See all" on the right.
- **Empty state**: centered icon in a soft circle (`colors.accentSoft`),
  a bold line + one muted line, and a single accent action. Never a bare
  "Нет данных".
- **Stat/number**: display the number big (`font.display`/`h1`, weight 900),
  label tiny + muted underneath.

## Motion (make it feel alive)
Use the built-in `Animated` API or `react-native-reanimated` (already available):
- **Press feedback**: scale to 0.97 on pressIn, spring back on pressOut for
  buttons and cards.
- **List entrance**: fade + 12px slide-up, staggered ~40ms per item on first
  mount.
- **Skeletons**: shimmer placeholders (animated opacity 0.5↔1) while loading —
  not a bare centered spinner on primary screens.
- **Hero/scroll**: subtle parallax or header shrink on scroll where it fits.
Keep durations 200–650ms, ease-out. Never block interaction on animation.

## The "not generated" checklist
Before finishing a screen, confirm:
- [ ] Uses `theme.ts` tokens (no stray `#111`, `padding: 15`, etc.).
- [ ] The accent color appears intentionally (active state / one CTA), not everywhere.
- [ ] Cards use shadow + radius, not gray borders.
- [ ] There is at least one motion detail (press, entrance, or skeleton).
- [ ] Empty/loading/error states are designed, not default.
- [ ] Real visual hierarchy: one clear focal point per card/section.
- [ ] Consistent spacing from the scale; comfortable, not cramped.

## When restyling
Change styling and composition; keep data flow, props, and navigation intact.
Prefer small reusable components (`Button`, `Card`, `Chip`, `Skeleton`,
`EmptyState`, `SectionHeader`) in `mobile/src/components/ui/` and reuse them.
