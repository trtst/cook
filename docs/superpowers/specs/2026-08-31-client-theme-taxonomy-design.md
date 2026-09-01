# Client Theme Taxonomy Design

**Date:** 2026-08-31

## Goal

Clarify the client theme model so that:

- `minimal-white` remains an independent theme skin.
- `bold-contrast` is removed from the product and codebase.
- `default` keeps only its own palettes.
- The theme settings page no longer presents `minimal-white` under the `default` theme palette list.

## Confirmed Decisions

1. A real theme skin stays an independently selectable theme.
2. `minimal-white` is a real theme skin, not a `default` palette.
3. `bold-contrast` must be removed as both:
   - an independent theme skin
   - a selectable palette or pseudo-palette
4. `default` palettes stay limited to `default`, `warm`, `olive`, and `cool`.
5. `fresh-ingredient`, `minimal-white`, `handdrawn-food`, and `apple-glass` remain separate theme options.

## Current Problem

The current theme settings page mixes two different concepts:

- theme family selection
- palette selection inside the `default` family

`minimal-white` and `bold-contrast` are currently exposed through the `default` family palette list even though `minimal-white` is now treated as a standalone theme and `bold-contrast` should be removed entirely.

## Design

### Theme Model

- Keep `default`, `fresh-ingredient`, `minimal-white`, `handdrawn-food`, and `apple-glass` in the theme skin registry.
- Remove `bold-contrast` from the theme skin registry, global theme stylesheet entry, and filesystem theme folder.
- Keep `default` as the only skin with multiple palettes.
- Limit `default` palettes to `default`, `warm`, `olive`, and `cool`.

### Theme Settings Page

- The theme list should expose five directly selectable items:
  - `default`
  - `fresh-ingredient`
  - `minimal-white`
  - `handdrawn-food`
  - `apple-glass`
- Only the `default` theme shows the palette card.
- The palette card for `default` only shows `default`, `warm`, `olive`, and `cool`.
- `minimal-white` no longer appears in the `default` palette card.

### Tests

- Update preset and registry tests so `bold-contrast` no longer appears.
- Update the theme page tests to reflect the five direct theme options and the smaller `default` palette list.
- Remove the `bold-contrast` shadow test and any other direct assertions tied only to that removed skin.

## Non-Goals

- No redesign of the visual appearance of the remaining themes.
- No restructuring of the overall theme runtime architecture beyond the minimum needed for this taxonomy cleanup.
- No changes to unrelated theme token behavior or theme persistence flow.
