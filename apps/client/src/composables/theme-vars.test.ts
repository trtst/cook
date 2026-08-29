import assert from "node:assert/strict";
import { buildThemeVars } from "./theme-vars";

const oneColorVars = buildThemeVars(
  {
    bg: "#f7f4ec",
    surface: "#fffdf8",
    text: "#2f2a24",
    primary: "#8dbf3c"
  },
  "light",
  "mono"
);

assert.equal(oneColorVars["--color-primary"], "#8dbf3c");
assert.equal(oneColorVars["--color-icon"], "#2f2a24");
assert.equal(oneColorVars["--color-icon-active"], "#8dbf3c");
assert.equal(oneColorVars["--color-icon-accent"], "rgb(184, 215, 131)");
assert.equal(oneColorVars["--color-icon-tertiary"], "rgba(47, 42, 36, 0.32)");
assert.equal(oneColorVars["--color-text-disabled"], "rgba(47, 42, 36, 0.32)");
assert.equal(oneColorVars["--button-primary-gradient-start"], "#8dbf3c");
assert.equal(oneColorVars["--button-primary-bg"], "linear-gradient(135deg, #8dbf3c 0%, rgb(184, 215, 131) 100%)");
assert.equal(oneColorVars["--button-secondary-bg"], oneColorVars["--color-surface-soft"]);
assert.equal(oneColorVars["--button-secondary-text"], oneColorVars["--color-text-secondary"]);
assert.equal(oneColorVars["--button-secondary-outline"], "transparent");
assert.equal(oneColorVars["--button-primary-border"], "transparent");
assert.equal(oneColorVars["--button-secondary-border"], "transparent");
assert.equal(oneColorVars["--button-danger-bg"], "#f47c35");
assert.equal(oneColorVars["--button-danger-text"], "#ffffff");
assert.equal(oneColorVars["--button-danger-shadow"], "0 3rpx 10rpx rgba(244, 124, 53, 0.14)");
assert.equal(oneColorVars["--button-danger-border"], "transparent");
assert.equal(oneColorVars["--button-danger-filter"], "none");
assert.equal(oneColorVars["--material-input-bg"], "#fffdf8");
assert.equal(oneColorVars["--material-input-border"], "rgba(141, 191, 60, 0.08)");
assert.equal(oneColorVars["--material-input-shadow"], "none");
assert.equal(oneColorVars["--material-input-filter"], "none");
assert.equal(oneColorVars["--material-control-bg"], "rgb(254, 252, 246)");
assert.equal(oneColorVars["--material-control-border"], "transparent");
assert.equal(oneColorVars["--material-control-shadow"], "none");
assert.equal(oneColorVars["--material-control-filter"], "none");
assert.equal(oneColorVars["--color-tag-neutral-bg"], oneColorVars["--color-surface-soft-muted"]);
assert.equal(oneColorVars["--color-tag-neutral-text"], oneColorVars["--color-text-secondary"]);
assert.equal(oneColorVars["--color-tag-primary-bg"], oneColorVars["--color-primary-soft"]);
assert.equal(oneColorVars["--color-tag-primary-text"], oneColorVars["--color-primary"]);
assert.equal(oneColorVars["--color-tag-secondary-bg"], oneColorVars["--color-secondary-soft"]);
assert.equal(oneColorVars["--color-tag-secondary-text"], oneColorVars["--color-secondary-contrast"]);
assert.equal(oneColorVars["--color-tag-success-bg"], "var(--color-state-success-soft)");
assert.equal(oneColorVars["--color-tag-success-text"], "var(--color-state-success-text)");
assert.equal(oneColorVars["--color-tag-warning-bg"], "var(--color-state-warning-soft)");
assert.equal(oneColorVars["--color-tag-warning-text"], "var(--color-state-warning-text)");
assert.equal(oneColorVars["--color-tag-danger-bg"], "var(--color-state-danger-soft)");
assert.equal(oneColorVars["--color-tag-danger-text"], "var(--color-state-danger-text)");
assert.equal(oneColorVars["--color-tag-bg"], undefined);
assert.equal(oneColorVars["--color-tag-text"], undefined);
assert.equal(oneColorVars["--color-tag-accent-bg"], undefined);
assert.equal(oneColorVars["--color-tag-accent-text"], undefined);
assert.equal(oneColorVars["--color-support-info"], oneColorVars["--color-surface-primary-panel"]);
assert.equal(oneColorVars["--color-support-highlight"], oneColorVars["--color-secondary-soft"]);
assert.equal(oneColorVars["--color-support-notice"], oneColorVars["--color-primary-soft-fill"]);
assert.equal(oneColorVars["--color-support-action"], oneColorVars["--color-primary"]);
assert.equal(oneColorVars["--color-state-success-base"], "#216e4e");
assert.equal(oneColorVars["--color-state-success-soft"], "rgb(206, 222, 211)");
assert.equal(oneColorVars["--color-state-success-text"], "#216e4e");
assert.equal(oneColorVars["--color-state-success-border"], "rgba(33, 110, 78, 0.18)");
assert.equal(oneColorVars["--color-state-warning-base"], "#d9902f");
assert.equal(oneColorVars["--color-state-warning-soft"], "rgb(247, 229, 204)");
assert.equal(oneColorVars["--color-state-warning-text"], "#d9902f");
assert.equal(oneColorVars["--color-state-warning-border"], "rgba(217, 144, 47, 0.22)");
assert.equal(oneColorVars["--color-state-danger-base"], "#f47c35");
assert.equal(oneColorVars["--color-state-danger-soft"], "rgb(252, 217, 193)");
assert.equal(oneColorVars["--color-state-danger-text"], "#f47c35");
assert.equal(oneColorVars["--color-state-danger-border"], "rgba(244, 124, 53, 0.18)");
assert.equal(oneColorVars["--color-state-info-base"], "#326fa8");
assert.equal(oneColorVars["--color-state-info-soft"], "rgb(222, 230, 235)");
assert.equal(oneColorVars["--color-state-info-text"], "#326fa8");
assert.equal(oneColorVars["--color-state-info-border"], "rgba(50, 111, 168, 0.16)");
assert.equal(oneColorVars["--color-state-disabled-base"], oneColorVars["--color-text-disabled"]);
assert.equal(oneColorVars["--color-state-disabled-soft"], oneColorVars["--color-surface-soft-muted"]);
assert.equal(oneColorVars["--color-state-disabled-text"], oneColorVars["--color-text-disabled"]);
assert.equal(oneColorVars["--color-state-disabled-border"], oneColorVars["--color-border-light"]);
assert.equal(
  oneColorVars["--color-state-warning-card-bg"],
  `radial-gradient(circle at 100% 0%, ${oneColorVars["--color-warning-halo"]} 0 26%, transparent 27%), linear-gradient(135deg, ${oneColorVars["--color-state-warning-soft"]} 0%, ${oneColorVars["--color-surface-soft-card"]} 100%)`
);
assert.equal(
  oneColorVars["--color-state-primary-card-bg"],
  `radial-gradient(circle at 100% 0%, ${oneColorVars["--color-primary-halo"]} 0 26%, transparent 27%), linear-gradient(135deg, ${oneColorVars["--color-primary-soft-fill-subtle"]} 0%, ${oneColorVars["--color-surface-soft-card"]} 100%)`
);
assert.equal(
  oneColorVars["--color-state-danger-card-bg"],
  `radial-gradient(circle at 100% 0%, ${oneColorVars["--color-danger-halo"]} 0 26%, transparent 27%), linear-gradient(135deg, ${oneColorVars["--color-state-danger-soft"]} 0%, ${oneColorVars["--color-surface-soft-card"]} 100%)`
);
assert.equal(oneColorVars["--color-nutrition-fat"], "var(--color-state-danger-base)");
assert.equal(oneColorVars["--color-nutrition-protein"], "var(--color-state-warning-base)");
assert.equal(oneColorVars["--color-nutrition-carbohydrate"], "var(--color-state-success-base)");
assert.equal(oneColorVars["--page-warm-bg"], "linear-gradient(180deg, rgb(250, 248, 241) 0%, rgb(241, 241, 226) 20%, #f7f4ec 100%)");
assert.equal(oneColorVars["--page-primary-soft-bg"], "radial-gradient(circle at top right, rgba(141, 191, 60, 0.18) 0, transparent 36%), #f7f4ec");
assert.equal(oneColorVars["--page-primary-fade-bg"], "linear-gradient(180deg, rgba(141, 191, 60, 0.18) 0%, #f7f4ec 100%)");
assert.equal(oneColorVars["--page-secondary-soft-bg"], "radial-gradient(circle at top right, rgba(184, 215, 131, 0.18), transparent 34%), linear-gradient(180deg, #f7f4ec 0%, #f7f4ec 100%)");
assert.equal(oneColorVars["--page-edge-fade-bg"], "linear-gradient(90deg, rgba(255, 253, 248, 0.16), #f7f4ec 28%)");
assert.equal(oneColorVars["--page-ambient-primary-bg"], "radial-gradient(circle at 82% 84%, rgba(141, 191, 60, 0.11) 0, transparent 34%), linear-gradient(180deg, #f7f4ec 0%, #f7f4ec 100%)");
assert.equal(oneColorVars["--page-ambient-duo-bg"], "radial-gradient(circle at 14% 18%, rgba(141, 191, 60, 0.11) 0, transparent 31%), radial-gradient(circle at 80% 14%, rgba(184, 215, 131, 0.1) 0, transparent 28%), linear-gradient(180deg, rgb(255, 252, 247) 0%, #f7f4ec 100%)");
assert.equal(oneColorVars["--page-hero-shell-bg"], "linear-gradient(180deg, rgba(255, 253, 248, 0.16), rgba(255, 253, 248, 0.42)), radial-gradient(circle at 16% 18%, rgb(246, 248, 233) 0, transparent 32%), radial-gradient(circle at 86% 12%, rgba(184, 215, 131, 0.18) 0, transparent 30%), linear-gradient(148deg, rgba(141, 191, 60, 0.18) 0%, rgb(255, 253, 249) 100%)");
assert.equal(oneColorVars["--page-hero-mask-bg"], "radial-gradient(100% 120% at 50% -30%, transparent 46%, rgba(255, 253, 248, 0.16) 53%, rgba(255, 253, 248, 0.42) 62%, rgba(255, 253, 248, 0.76) 75%, #fffdf8 90%)");
assert.equal(oneColorVars["--page-hero-orb-bg"], "rgba(255, 253, 248, 0.42)");
assert.equal(
  oneColorVars["--page-bottom-mask-image"],
  "radial-gradient(ellipse at 15% 100%, #000 0%, rgba(0, 0, 0, 0.76) 36%, transparent 72%), radial-gradient(ellipse at 85% 100%, #000 0%, rgba(0, 0, 0, 0.76) 36%, transparent 72%), linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.42) 50%, #000 100%)"
);
assert.equal(oneColorVars["--page-overlay-veil-bg"], "linear-gradient(180deg, rgba(255, 253, 248, 0.42) 0%, rgba(255, 253, 248, 0.76) 58%, #f7f4ec 100%)");
assert.equal(oneColorVars["--page-overlay-veil-filter"], "saturate(180%) blur(22rpx)");
assert.equal(oneColorVars["--page-glow-cluster-start-bg"], "radial-gradient(circle at 68% 14%, rgba(141, 191, 60, 0.18) 0%, transparent 34%), radial-gradient(circle at 22% 34%, rgba(141, 191, 60, 0.18) 0%, transparent 38%), radial-gradient(circle at 60% 58%, rgba(141, 191, 60, 0.18) 0%, transparent 36%), radial-gradient(circle at 28% 84%, rgba(141, 191, 60, 0.18) 0%, transparent 32%)");
assert.equal(oneColorVars["--page-glow-cluster-end-bg"], "radial-gradient(circle at 34% 12%, rgba(141, 191, 60, 0.18) 0%, transparent 34%), radial-gradient(circle at 76% 36%, rgba(141, 191, 60, 0.18) 0%, transparent 38%), radial-gradient(circle at 36% 62%, rgba(141, 191, 60, 0.18) 0%, transparent 36%), radial-gradient(circle at 70% 86%, rgba(141, 191, 60, 0.18) 0%, transparent 34%)");
assert.equal(
  oneColorVars["--page-cover-fresh-shell-bg"],
  "linear-gradient(180deg, rgba(255, 253, 248, 0.16) 0%, rgba(255, 253, 248, 0.42) 100%), linear-gradient(140deg, rgb(246, 248, 233) 0%, rgb(255, 253, 249) 48%, #fffdf8 100%)"
);
assert.equal(oneColorVars["--color-primary-halo"], "rgba(141, 191, 60, 0.11)");
assert.equal(oneColorVars["--color-secondary-halo"], "rgba(184, 215, 131, 0.1)");
assert.equal(oneColorVars["--color-surface-soft-card"], "rgb(254, 252, 246)");
assert.equal(oneColorVars["--color-surface-soft-panel"], "rgb(254, 253, 247)");
assert.equal(oneColorVars["--color-surface-soft-muted"], "rgb(253, 252, 246)");
assert.equal(oneColorVars["--color-surface-overlay"], "rgb(254, 252, 247)");
assert.equal(oneColorVars["--color-surface-overlay-soft"], "rgb(255, 252, 247)");
assert.equal(oneColorVars["--color-surface-overlay-weak"], "rgb(254, 252, 247)");
assert.equal(oneColorVars["--color-surface-muted-frost"], "rgba(246, 248, 233, 0.68)");
assert.equal(oneColorVars["--color-primary-soft-fill"], "rgb(223, 236, 195)");
assert.equal(oneColorVars["--color-primary-soft-fill-medium"], "rgb(219, 233, 188)");
assert.equal(oneColorVars["--color-primary-soft-fill-subtle"], "rgb(207, 227, 169)");
assert.equal(oneColorVars["--color-primary-soft-fill-strong"], "rgb(237, 243, 218)");
assert.equal(oneColorVars["--color-primary-soft-fill-soft"], "rgb(205, 226, 165)");
assert.equal(oneColorVars["--color-primary-soft-fill-weak"], "rgb(189, 217, 139)");
assert.equal(oneColorVars["--color-surface-primary-panel"], "rgb(234, 242, 214)");
assert.equal(oneColorVars["--color-surface-primary-panel-soft"], "rgb(239, 244, 222)");
assert.equal(oneColorVars["--color-warning-soft-fill"], "var(--color-state-warning-soft)");
assert.equal(oneColorVars["--color-warning-soft-fill-strong"], "rgb(243, 218, 184)");
assert.equal(oneColorVars["--color-warning-halo"], "rgba(217, 144, 47, 0.15)");
assert.equal(oneColorVars["--color-danger-soft-fill"], "var(--color-state-danger-soft)");
assert.equal(oneColorVars["--color-danger-soft-fill-strong"], "rgb(253, 225, 205)");
assert.equal(oneColorVars["--color-danger-halo"], "rgba(244, 124, 53, 0.11)");
assert.equal(oneColorVars["--color-success-soft-fill"], "var(--color-state-success-soft)");
assert.equal(oneColorVars["--color-info-soft-fill"], "var(--color-state-info-soft)");
assert.equal(oneColorVars["--color-border-light"], "rgba(141, 191, 60, 0.08)");
assert.equal(oneColorVars["--color-border-active"], "rgba(141, 191, 60, 0.24)");
assert.equal(oneColorVars["--material-card-border"], "transparent");
assert.equal(
  oneColorVars["--material-card-accent-bg"],
  "radial-gradient(circle at top right, rgba(184, 215, 131, 0.18) 0, transparent 36%), rgb(254, 252, 246)"
);
assert.equal(oneColorVars["--material-panel-border"], "transparent");
assert.equal(oneColorVars["--material-tabbar-border"], "transparent");
assert.equal(oneColorVars["--page-hero-bg"], "radial-gradient(circle at 16% 18%, rgb(246, 248, 233) 0, transparent 32%), radial-gradient(circle at 86% 12%, rgba(184, 215, 131, 0.18) 0, transparent 30%), linear-gradient(148deg, rgba(141, 191, 60, 0.18) 0%, rgb(255, 253, 249) 100%)");
assert.equal(oneColorVars["--color-illustration-ink"], "#1b1b1b");
assert.equal(oneColorVars["--color-illustration-plate"], "rgb(252, 249, 243)");
assert.equal(oneColorVars["--color-illustration-rice"], "#fff0d7");
assert.equal(oneColorVars["--color-illustration-warm"], "#f3b15b");
assert.equal(oneColorVars["--color-illustration-fresh"], "rgb(133, 188, 74)");
assert.equal(oneColorVars["--color-illustration-sunny"], "rgb(210, 215, 122)");
assert.equal(oneColorVars["--color-illustration-leaf-soft"], "#d7efc2");
assert.equal(oneColorVars["--color-illustration-leaf-strong"], "#a9d58e");
assert.equal(oneColorVars["--color-illustration-egg"], "#ffd87d");
assert.equal(oneColorVars["--color-illustration-bowl"], "rgba(184, 215, 131, 0.18)");
assert.equal(oneColorVars["--color-illustration-cup"], "rgb(246, 248, 233)");
assert.equal(oneColorVars["--shadow-illustration"], "0 8rpx 20rpx rgba(141, 191, 60, 0.1)");
assert.equal(oneColorVars["--shadow-illustration-dot"], "6rpx -6rpx 0 -2rpx rgba(184, 215, 131, 0.1)");
assert.equal(oneColorVars["--page-hero-halo-bg"], "radial-gradient(circle at 78% 16%, rgba(141, 191, 60, 0.18) 0, transparent 34%), radial-gradient(circle at 8% 42%, rgba(184, 215, 131, 0.18) 0, transparent 30%), linear-gradient(132deg, rgb(255, 253, 249) 0%, rgb(246, 248, 233) 100%)");
assert.equal(oneColorVars["--page-cover-fresh-bg"], "linear-gradient(140deg, rgb(246, 248, 233) 0%, rgb(255, 253, 249) 48%, #fffdf8 100%)");
assert.equal(oneColorVars["--overlay-hero-banner-shade"], "linear-gradient(180deg, rgb(66, 67, 61), rgb(33, 33, 31)), radial-gradient(circle at right top, rgba(255, 255, 255, 0.1), transparent 36%)");
assert.equal(oneColorVars["--color-cover-empty-warm-bg"], "radial-gradient(circle at top right, rgba(184, 215, 131, 0.18), transparent 40%), linear-gradient(135deg, rgb(239, 244, 222), rgb(247, 229, 204))");
assert.equal(oneColorVars["--color-illustration-panel-warm"], "linear-gradient(145deg, rgba(141, 191, 60, 0.18) 0%, rgb(255, 253, 249) 100%)");
assert.equal(oneColorVars["--color-illustration-panel-fresh"], "linear-gradient(145deg, rgb(246, 248, 233) 0%, rgb(255, 253, 249) 100%)");
assert.equal(oneColorVars["--color-illustration-panel-accent"], "linear-gradient(145deg, rgba(184, 215, 131, 0.18) 0%, rgb(255, 253, 249) 100%)");
assert.equal(oneColorVars["--shadow-card"], "0 2rpx 8rpx rgba(141, 191, 60, 0.06)");
assert.equal(oneColorVars["--shadow-floating"], "0 -2rpx 8rpx rgba(141, 191, 60, 0.08)");
assert.equal(oneColorVars["--shadow-tabbar"], "0 2rpx 8rpx rgba(141, 191, 60, 0.06)");
assert.equal(oneColorVars["--button-primary-shadow"], "0 3rpx 10rpx rgba(141, 191, 60, 0.1)");
assert.equal(oneColorVars["--color-shimmer-strong"], "rgba(255, 253, 248, 0.42)");
assert.equal(oneColorVars["--color-shimmer-soft"], "rgba(255, 253, 248, 0.18)");
assert.equal(oneColorVars["--color-shadow-overlay"], "rgba(47, 42, 36, 0.18)");
assert.equal(oneColorVars["--color-surface-raised"], "rgb(255, 253, 249)");
assert.equal(oneColorVars["--color-primary-selected"], "rgb(173, 209, 115)");
assert.equal(oneColorVars["--color-overlay-strong"], "rgb(52, 53, 48)");
assert.equal(oneColorVars["--color-overlay-medium"], "rgb(66, 67, 61)");
assert.equal(oneColorVars["--color-overlay-stage"], "rgb(33, 33, 31)");
assert.equal(oneColorVars["--color-overlay-text"], "#ffffff");
assert.equal(oneColorVars["--color-overlay-text-muted"], "rgba(255, 255, 255, 0.84)");
assert.equal(oneColorVars["--color-overlay-line"], "rgba(255, 255, 255, 0.72)");
assert.equal(oneColorVars["--color-overlay-control"], "rgba(255, 255, 255, 0.1)");
assert.equal(oneColorVars["--color-overlay-sheen-top"], "rgba(255, 255, 255, 0.02)");
assert.equal(oneColorVars["--color-overlay-sheen-bottom"], "rgba(255, 255, 255, 0.01)");
assert.equal(oneColorVars["--color-overlay-scrim"], "rgba(0, 0, 0, 0.56)");
assert.equal(oneColorVars["--overlay-image-mask"], "linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.18) 28%, rgba(0, 0, 0, 0.92) 100%)");
assert.equal(oneColorVars["--color-text-inverse-strong"], "rgba(255, 255, 255, 0.92)");
assert.equal(oneColorVars["--color-text-inverse-muted"], "rgba(255, 255, 255, 0.84)");
assert.equal(oneColorVars["--color-mask-solid"], "#000");
assert.equal(oneColorVars["--color-mask-strong"], "rgba(0, 0, 0, 0.76)");
assert.equal(oneColorVars["--color-mask-mid"], "rgba(0, 0, 0, 0.42)");
assert.equal(oneColorVars["--login-popup-hero-shadow"], "rgba(68, 75, 41, 0.08)");
assert.equal(oneColorVars["--login-popup-sheet-border"], "transparent");
assert.equal(oneColorVars["--login-popup-backdrop-filter"], "blur(24rpx) saturate(145%)");
assert.equal(oneColorVars["--login-popup-sheet-filter"], "blur(28rpx) saturate(150%)");
assert.equal(oneColorVars["--frosted-mask-image"], "linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.1) 36%, rgba(0, 0, 0, 1) 100%)");
assert.equal(oneColorVars["--feedback-glow-start"], "rgba(255, 253, 248, 0)");
assert.equal(oneColorVars["--feedback-line-primary"], "linear-gradient(90deg, #8dbf3c 0%, rgb(184, 215, 131) 100%)");
for (const legacyHomeIllustrationToken of [
  "--home-hero-copy",
  "--home-hero-copy-muted",
  "--home-hero-button-bg",
  "--home-hero-ghost-bg",
  "--home-hero-bg",
  "--home-hero-banner-bg",
  "--home-hero-action-bg",
  "--home-hero-banner-shade",
  "--home-illustration-outline",
  "--home-illustration-plate-bg",
  "--home-illustration-food-rice",
  "--home-illustration-food-orange",
  "--home-illustration-food-green",
  "--home-illustration-food-yellow",
  "--home-scene-border-width",
  "--home-scene-board-shadow",
  "--home-scene-leaf-left",
  "--home-scene-leaf-right",
  "--home-scene-egg-bg",
  "--home-scene-bowl-bg",
  "--home-scene-cup-bg",
  "--home-scene-outline",
  "--home-scene-plate-bg",
  "--home-scene-food-rice",
  "--home-scene-food-orange",
  "--home-scene-food-green",
  "--home-scene-food-yellow",
  "--home-entry-feature-main-bg",
  "--home-entry-feature-mint-bg",
  "--home-entry-feature-green-bg",
  "--home-entry-art-bg",
  "--home-entry-art-shadow",
  "--home-entry-mini-text",
  "--home-entry-dot-bg",
  "--home-entry-dot-shadow",
  "--home-pantry-panel-bg",
  "--home-recent-panel-bg",
  "--home-recent-back-bg",
  "--home-entry-recipe-warm-bg",
  "--home-entry-recipe-fresh-bg",
  "--home-entry-recipe-cool-bg",
  "--home-entry-plate-bg",
  "--home-entry-plate-border",
  "--home-entry-food-rice",
  "--home-entry-food-orange",
  "--home-entry-food-green",
  "--home-entry-food-yellow"
] as const) {
  assert.equal(oneColorVars[legacyHomeIllustrationToken], undefined);
}
for (const internalThemeToken of [
  "--theme-bg",
  "--theme-surface",
  "--theme-text",
  "--theme-primary",
  "--theme-secondary",
  "--theme-accent"
] as const) {
  assert.equal(oneColorVars[internalThemeToken], undefined);
}
for (const legacyEntryToken of [
  "--entry-board-bg",
  "--entry-board-shadow",
  "--entry-primary-bg",
  "--entry-side-mint-bg",
  "--entry-side-aqua-bg",
  "--entry-ink",
  "--entry-outline",
  "--entry-accent",
  "--entry-muted-text",
  "--entry-side-muted-text",
  "--entry-photo-bg",
  "--entry-photo-shadow",
  "--entry-photo-plate-bg",
  "--entry-button-bg",
  "--entry-button-color",
  "--entry-button-shadow"
] as const) {
  assert.equal(oneColorVars[legacyEntryToken], undefined);
}
assert.ok(oneColorVars["--color-secondary"]);
assert.equal(oneColorVars["--color-tag-bg"], undefined);
assert.equal(oneColorVars["--color-tag-accent-bg"], undefined);
assert.equal(oneColorVars["--color-success-contrast"], undefined);
assert.equal(oneColorVars["--color-success-button-bg"], undefined);
assert.equal(oneColorVars["--color-success-button-text"], undefined);
assert.equal(oneColorVars["--color-warning-contrast"], undefined);
assert.equal(oneColorVars["--color-warning-button-bg"], undefined);
assert.equal(oneColorVars["--color-warning-button-text"], undefined);
assert.equal(oneColorVars["--color-danger-contrast"], undefined);
assert.equal(oneColorVars["--color-danger-button-bg"], undefined);
assert.equal(oneColorVars["--color-danger-button-text"], undefined);
assert.equal(oneColorVars["--color-info-contrast"], undefined);
assert.equal(oneColorVars["--color-info-button-bg"], undefined);
assert.equal(oneColorVars["--color-info-button-text"], undefined);
assert.ok(oneColorVars["--tier-badge-free-bg"]?.startsWith("linear-gradient(135deg, "));
assert.equal(oneColorVars["--tier-badge-pro-text"], "#ffffff");

const twoColorVars = buildThemeVars(
  {
    bg: "#f7f4ec",
    surface: "#fffdf8",
    text: "#2f2a24",
    primary: "#8dbf3c",
    secondary: "#f3c77a"
  },
  "light",
  "duo"
);

assert.equal(twoColorVars["--color-secondary"], "#f3c77a");
assert.equal(twoColorVars["--button-primary-gradient-end"], "#f3c77a");
assert.equal(twoColorVars["--button-primary-bg"], "linear-gradient(135deg, #8dbf3c 0%, #f3c77a 100%)");
assert.equal(twoColorVars["--button-secondary-bg"], twoColorVars["--color-surface-soft"]);
assert.equal(twoColorVars["--button-secondary-text"], twoColorVars["--color-text-secondary"]);
assert.equal(twoColorVars["--button-secondary-outline"], "transparent");
assert.equal(twoColorVars["--button-primary-border"], "transparent");
assert.equal(twoColorVars["--button-secondary-border"], "transparent");
assert.equal(twoColorVars["--button-danger-bg"], "#f47c35");
assert.equal(twoColorVars["--button-danger-text"], "#ffffff");
assert.equal(twoColorVars["--button-danger-shadow"], "0 3rpx 10rpx rgba(244, 124, 53, 0.14)");
assert.equal(twoColorVars["--button-danger-border"], "transparent");
assert.equal(twoColorVars["--button-danger-filter"], "none");
assert.equal(twoColorVars["--material-input-bg"], "#fffdf8");
assert.equal(twoColorVars["--material-input-border"], "rgba(141, 191, 60, 0.08)");
assert.equal(twoColorVars["--material-input-shadow"], "none");
assert.equal(twoColorVars["--material-input-filter"], "none");
assert.equal(twoColorVars["--material-control-bg"], "rgb(254, 252, 246)");
assert.equal(twoColorVars["--material-control-border"], "transparent");
assert.equal(twoColorVars["--material-control-shadow"], "none");
assert.equal(twoColorVars["--material-control-filter"], "none");
assert.equal(twoColorVars["--material-card-border"], "transparent");
assert.equal(twoColorVars["--material-panel-border"], "transparent");
assert.equal(twoColorVars["--material-tabbar-border"], "transparent");
assert.equal(twoColorVars["--color-tag-neutral-bg"], twoColorVars["--color-surface-soft-muted"]);
assert.equal(twoColorVars["--color-tag-neutral-text"], twoColorVars["--color-text-secondary"]);
assert.equal(twoColorVars["--color-tag-primary-bg"], twoColorVars["--color-primary-soft"]);
assert.equal(twoColorVars["--color-tag-primary-text"], twoColorVars["--color-primary"]);
assert.equal(twoColorVars["--color-tag-secondary-bg"], twoColorVars["--color-secondary-soft"]);
assert.equal(twoColorVars["--color-tag-secondary-text"], twoColorVars["--color-secondary-contrast"]);
assert.equal(twoColorVars["--color-tag-success-bg"], "var(--color-state-success-soft)");
assert.equal(twoColorVars["--color-tag-success-text"], "var(--color-state-success-text)");
assert.equal(twoColorVars["--color-tag-warning-bg"], "var(--color-state-warning-soft)");
assert.equal(twoColorVars["--color-tag-warning-text"], "var(--color-state-warning-text)");
assert.equal(twoColorVars["--color-tag-danger-bg"], "var(--color-state-danger-soft)");
assert.equal(twoColorVars["--color-tag-danger-text"], "var(--color-state-danger-text)");
assert.equal(twoColorVars["--color-tag-bg"], undefined);
assert.equal(twoColorVars["--color-tag-text"], undefined);
assert.equal(twoColorVars["--color-tag-accent-bg"], undefined);
assert.equal(twoColorVars["--color-tag-accent-text"], undefined);
assert.equal(twoColorVars["--color-support-info"], twoColorVars["--color-surface-primary-panel"]);
assert.equal(twoColorVars["--color-support-highlight"], twoColorVars["--color-secondary-soft"]);
assert.equal(twoColorVars["--color-support-notice"], twoColorVars["--color-primary-soft-fill"]);
assert.equal(twoColorVars["--color-state-success-base"], "#216e4e");
assert.equal(twoColorVars["--color-state-success-soft"], "rgb(206, 222, 211)");
assert.equal(twoColorVars["--color-state-success-text"], "#216e4e");
assert.equal(twoColorVars["--color-state-success-border"], "rgba(33, 110, 78, 0.18)");
assert.equal(twoColorVars["--color-state-warning-base"], "#d9902f");
assert.equal(twoColorVars["--color-state-warning-soft"], "rgb(247, 229, 204)");
assert.equal(twoColorVars["--color-state-warning-text"], "#d9902f");
assert.equal(twoColorVars["--color-state-warning-border"], "rgba(217, 144, 47, 0.22)");
assert.equal(twoColorVars["--color-state-danger-base"], "#f47c35");
assert.equal(twoColorVars["--color-state-danger-soft"], "rgb(252, 217, 193)");
assert.equal(twoColorVars["--color-state-danger-text"], "#f47c35");
assert.equal(twoColorVars["--color-state-danger-border"], "rgba(244, 124, 53, 0.18)");
assert.equal(twoColorVars["--color-state-info-base"], "#326fa8");
assert.equal(twoColorVars["--color-state-info-soft"], "rgb(222, 230, 235)");
assert.equal(twoColorVars["--color-state-info-text"], "#326fa8");
assert.equal(twoColorVars["--color-state-info-border"], "rgba(50, 111, 168, 0.16)");
assert.equal(twoColorVars["--color-state-disabled-base"], twoColorVars["--color-text-disabled"]);
assert.equal(twoColorVars["--color-state-disabled-soft"], twoColorVars["--color-surface-soft-muted"]);
assert.equal(twoColorVars["--color-state-disabled-text"], twoColorVars["--color-text-disabled"]);
assert.equal(twoColorVars["--color-state-disabled-border"], twoColorVars["--color-border-light"]);
assert.equal(
  twoColorVars["--color-state-warning-card-bg"],
  `radial-gradient(circle at 100% 0%, ${twoColorVars["--color-warning-halo"]} 0 26%, transparent 27%), linear-gradient(135deg, ${twoColorVars["--color-state-warning-soft"]} 0%, ${twoColorVars["--color-surface-soft-card"]} 100%)`
);
assert.equal(
  twoColorVars["--color-state-primary-card-bg"],
  `radial-gradient(circle at 100% 0%, ${twoColorVars["--color-primary-halo"]} 0 26%, transparent 27%), linear-gradient(135deg, ${twoColorVars["--color-primary-soft-fill-subtle"]} 0%, ${twoColorVars["--color-surface-soft-card"]} 100%)`
);
assert.equal(
  twoColorVars["--color-state-danger-card-bg"],
  `radial-gradient(circle at 100% 0%, ${twoColorVars["--color-danger-halo"]} 0 26%, transparent 27%), linear-gradient(135deg, ${twoColorVars["--color-state-danger-soft"]} 0%, ${twoColorVars["--color-surface-soft-card"]} 100%)`
);
assert.equal(twoColorVars["--color-nutrition-fat"], "var(--color-state-danger-base)");
assert.equal(twoColorVars["--color-nutrition-protein"], "var(--color-state-warning-base)");
assert.equal(twoColorVars["--color-nutrition-carbohydrate"], "var(--color-state-success-base)");
assert.equal(twoColorVars["--page-warm-bg"], "linear-gradient(180deg, rgb(250, 248, 241) 0%, rgb(247, 240, 225) 20%, #f7f4ec 100%)");
assert.equal(twoColorVars["--page-primary-soft-bg"], "radial-gradient(circle at top right, rgba(141, 191, 60, 0.18) 0, transparent 36%), #f7f4ec");
assert.equal(twoColorVars["--page-primary-fade-bg"], "linear-gradient(180deg, rgba(141, 191, 60, 0.18) 0%, #f7f4ec 100%)");
assert.equal(twoColorVars["--page-secondary-soft-bg"], "radial-gradient(circle at top right, rgba(243, 199, 122, 0.18), transparent 34%), linear-gradient(180deg, #f7f4ec 0%, #f7f4ec 100%)");
assert.equal(twoColorVars["--page-edge-fade-bg"], "linear-gradient(90deg, rgba(255, 253, 248, 0.16), #f7f4ec 28%)");
assert.equal(twoColorVars["--page-ambient-primary-bg"], "radial-gradient(circle at 82% 84%, rgba(141, 191, 60, 0.11) 0, transparent 34%), linear-gradient(180deg, #f7f4ec 0%, #f7f4ec 100%)");
assert.equal(twoColorVars["--page-ambient-duo-bg"], "radial-gradient(circle at 14% 18%, rgba(141, 191, 60, 0.11) 0, transparent 31%), radial-gradient(circle at 80% 14%, rgba(243, 199, 122, 0.1) 0, transparent 28%), linear-gradient(180deg, rgb(255, 252, 247) 0%, #f7f4ec 100%)");
assert.equal(twoColorVars["--page-hero-shell-bg"], "linear-gradient(180deg, rgba(255, 253, 248, 0.16), rgba(255, 253, 248, 0.42)), radial-gradient(circle at 16% 18%, rgb(246, 248, 233) 0, transparent 32%), radial-gradient(circle at 86% 12%, rgba(243, 199, 122, 0.18) 0, transparent 30%), linear-gradient(148deg, rgba(141, 191, 60, 0.18) 0%, rgb(255, 253, 249) 100%)");
assert.equal(
  twoColorVars["--page-cover-fresh-shell-bg"],
  "linear-gradient(180deg, rgba(255, 253, 248, 0.16) 0%, rgba(255, 253, 248, 0.42) 100%), linear-gradient(140deg, rgb(246, 248, 233) 0%, rgb(255, 253, 249) 48%, #fffdf8 100%)"
);
assert.equal(twoColorVars["--color-cover-empty-warm-bg"], "radial-gradient(circle at top right, rgba(243, 199, 122, 0.18), transparent 40%), linear-gradient(135deg, rgb(239, 244, 222), rgb(247, 229, 204))");
assert.equal(twoColorVars["--color-illustration-panel-accent"], "linear-gradient(145deg, rgba(243, 199, 122, 0.18) 0%, rgb(255, 253, 249) 100%)");
assert.equal(twoColorVars["--color-warning-soft-fill"], "var(--color-state-warning-soft)");
assert.equal(twoColorVars["--page-hero-bg"], "radial-gradient(circle at 16% 18%, rgb(246, 248, 233) 0, transparent 32%), radial-gradient(circle at 86% 12%, rgba(243, 199, 122, 0.18) 0, transparent 30%), linear-gradient(148deg, rgba(141, 191, 60, 0.18) 0%, rgb(255, 253, 249) 100%)");
assert.equal(twoColorVars["--shadow-illustration-dot"], "6rpx -6rpx 0 -2rpx rgba(243, 199, 122, 0.1)");
assert.equal(twoColorVars["--color-tag-secondary-text"], "#1b1b1b");
assert.equal(twoColorVars["--tier-badge-plus-text"], "#6d470f");
assert.equal(twoColorVars["--login-popup-sheet-border"], "transparent");
assert.equal(twoColorVars["--login-popup-backdrop-filter"], "blur(24rpx) saturate(145%)");
assert.equal(twoColorVars["--login-popup-sheet-filter"], "blur(28rpx) saturate(150%)");
assert.equal(twoColorVars["--feedback-line-primary"], "linear-gradient(90deg, #8dbf3c 0%, #f3c77a 100%)");

const darkVars = buildThemeVars(
  {
    bg: "#111715",
    surface: "#18201d",
    text: "#f6efe8",
    primary: "#5a9d90",
    secondary: "#8fbf8c"
  },
  "dark",
  "duo"
);

const forcedMonoVars = buildThemeVars(
  {
    bg: "#f7f4ec",
    surface: "#fffdf8",
    text: "#2f2a24",
    primary: "#8dbf3c",
    secondary: "#ff4f4f"
  },
  "light",
  "mono"
);

assert.throws(
  () =>
    buildThemeVars(
      {
        bg: "#f7f4ec",
        surface: "#fffdf8",
        text: "#2f2a24",
        primary: "#8dbf3c"
      },
      "light",
      "duo"
    ),
  /duo theme requires secondary seed/i
);

assert.equal(darkVars["--color-overlay-text"], "#ffffff");
assert.equal(darkVars["--color-overlay-text-muted"], "rgba(255, 255, 255, 0.84)");
assert.equal(darkVars["--button-primary-border"], "transparent");
assert.equal(darkVars["--button-secondary-border"], "transparent");
assert.equal(darkVars["--button-danger-bg"], "#f47c35");
assert.equal(darkVars["--button-danger-text"], "#ffffff");
assert.equal(darkVars["--button-danger-shadow"], "0 3rpx 10rpx rgba(244, 124, 53, 0.18)");
assert.equal(darkVars["--button-danger-border"], "transparent");
assert.equal(darkVars["--button-danger-filter"], "none");
assert.equal(darkVars["--material-card-border"], "transparent");
assert.equal(darkVars["--material-panel-border"], "transparent");
assert.equal(darkVars["--material-tabbar-border"], "transparent");
assert.equal(darkVars["--color-icon-tertiary"], "rgba(246, 239, 232, 0.38)");
assert.equal(darkVars["--color-text-disabled"], "rgba(246, 239, 232, 0.38)");
assert.equal(darkVars["--color-tag-neutral-bg"], darkVars["--color-surface-soft-muted"]);
assert.equal(darkVars["--color-tag-neutral-text"], darkVars["--color-text-secondary"]);
assert.equal(darkVars["--color-tag-primary-bg"], darkVars["--color-primary-soft"]);
assert.equal(darkVars["--color-tag-primary-text"], darkVars["--color-primary"]);
assert.equal(darkVars["--color-tag-secondary-bg"], darkVars["--color-secondary-soft"]);
assert.equal(darkVars["--color-tag-secondary-text"], darkVars["--color-secondary-contrast"]);
assert.equal(darkVars["--color-tag-success-bg"], "var(--color-state-success-soft)");
assert.equal(darkVars["--color-tag-success-text"], "var(--color-state-success-text)");
assert.equal(darkVars["--color-tag-warning-bg"], "var(--color-state-warning-soft)");
assert.equal(darkVars["--color-tag-warning-text"], "var(--color-state-warning-text)");
assert.equal(darkVars["--color-tag-danger-bg"], "var(--color-state-danger-soft)");
assert.equal(darkVars["--color-tag-danger-text"], "var(--color-state-danger-text)");
assert.equal(darkVars["--color-tag-bg"], undefined);
assert.equal(darkVars["--color-tag-text"], undefined);
assert.equal(darkVars["--color-tag-accent-bg"], undefined);
assert.equal(darkVars["--color-tag-accent-text"], undefined);
assert.equal(darkVars["--color-support-info"], darkVars["--color-surface-primary-panel"]);
assert.equal(darkVars["--color-support-highlight"], darkVars["--color-secondary-soft"]);
assert.equal(darkVars["--color-support-notice"], darkVars["--color-primary-soft-fill"]);
assert.equal(darkVars["--color-state-success-base"], "#6eca94");
assert.equal(darkVars["--color-state-success-soft"], "rgb(26, 49, 40)");
assert.equal(darkVars["--color-state-success-text"], "#6eca94");
assert.equal(darkVars["--color-state-success-border"], "rgba(110, 202, 148, 0.22)");
assert.equal(darkVars["--color-state-warning-base"], "#d9902f");
assert.equal(darkVars["--color-state-warning-soft"], "rgb(66, 57, 33)");
assert.equal(darkVars["--color-state-warning-text"], "#d9902f");
assert.equal(darkVars["--color-state-warning-border"], "rgba(217, 144, 47, 0.22)");
assert.equal(darkVars["--color-state-danger-base"], "#f47c35");
assert.equal(darkVars["--color-state-danger-soft"], "rgb(86, 58, 36)");
assert.equal(darkVars["--color-state-danger-text"], "#f47c35");
assert.equal(darkVars["--color-state-danger-border"], "rgba(244, 124, 53, 0.22)");
assert.equal(darkVars["--color-state-info-base"], "#326fa8");
assert.equal(darkVars["--color-state-info-soft"], "rgb(28, 45, 51)");
assert.equal(darkVars["--color-state-info-text"], "#326fa8");
assert.equal(darkVars["--color-state-info-border"], "rgba(50, 111, 168, 0.22)");
assert.equal(darkVars["--color-state-disabled-base"], darkVars["--color-text-disabled"]);
assert.equal(darkVars["--color-state-disabled-soft"], darkVars["--color-surface-soft-muted"]);
assert.equal(darkVars["--color-state-disabled-text"], darkVars["--color-text-disabled"]);
assert.equal(darkVars["--color-state-disabled-border"], darkVars["--color-border-light"]);
assert.equal(
  darkVars["--color-state-warning-card-bg"],
  `radial-gradient(circle at 100% 0%, ${darkVars["--color-warning-halo"]} 0 26%, transparent 27%), linear-gradient(135deg, ${darkVars["--color-state-warning-soft"]} 0%, ${darkVars["--color-surface-soft-card"]} 100%)`
);
assert.equal(
  darkVars["--color-state-primary-card-bg"],
  `radial-gradient(circle at 100% 0%, ${darkVars["--color-primary-halo"]} 0 26%, transparent 27%), linear-gradient(135deg, ${darkVars["--color-primary-soft-fill-subtle"]} 0%, ${darkVars["--color-surface-soft-card"]} 100%)`
);
assert.equal(
  darkVars["--color-state-danger-card-bg"],
  `radial-gradient(circle at 100% 0%, ${darkVars["--color-danger-halo"]} 0 26%, transparent 27%), linear-gradient(135deg, ${darkVars["--color-state-danger-soft"]} 0%, ${darkVars["--color-surface-soft-card"]} 100%)`
);
assert.equal(darkVars["--color-primary-halo"], "rgba(90, 157, 144, 0.14)");
assert.equal(darkVars["--color-secondary-halo"], "rgba(143, 191, 140, 0.13)");
assert.equal(darkVars["--color-warning-halo"], "rgba(217, 144, 47, 0.16)");
assert.equal(darkVars["--color-danger-halo"], "rgba(244, 124, 53, 0.14)");
assert.equal(darkVars["--shadow-card"], "0 2rpx 8rpx rgba(90, 157, 144, 0.1)");
assert.equal(darkVars["--shadow-floating"], "0 -2rpx 8rpx rgba(90, 157, 144, 0.12)");
assert.equal(darkVars["--shadow-tabbar"], "0 2rpx 8rpx rgba(90, 157, 144, 0.1)");
assert.equal(darkVars["--button-primary-shadow"], "0 3rpx 10rpx rgba(90, 157, 144, 0.14)");
assert.equal(darkVars["--login-popup-sheet-border"], "transparent");
assert.equal(darkVars["--login-popup-backdrop-filter"], "blur(24rpx) saturate(145%)");
assert.equal(darkVars["--login-popup-sheet-filter"], "blur(28rpx) saturate(150%)");
assert.equal(darkVars["--color-overlay-strong"], "rgb(8, 13, 11)");
assert.equal(darkVars["--color-overlay-medium"], "rgb(9, 14, 13)");
assert.equal(darkVars["--color-overlay-stage"], "rgb(5, 8, 8)");
assert.equal(darkVars["--color-overlay-line"], "rgba(255, 255, 255, 0.64)");
assert.equal(darkVars["--color-overlay-control"], "rgba(255, 255, 255, 0.14)");
assert.equal(darkVars["--color-overlay-sheen-top"], "rgba(255, 255, 255, 0.04)");
assert.equal(darkVars["--color-overlay-sheen-bottom"], "rgba(255, 255, 255, 0.02)");
assert.equal(darkVars["--color-overlay-scrim"], "rgba(0, 0, 0, 0.48)");
assert.equal(darkVars["--overlay-image-mask"], "linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.2) 28%, rgba(0, 0, 0, 0.9) 100%)");
assert.equal(darkVars["--page-primary-fade-bg"], "linear-gradient(180deg, rgba(90, 157, 144, 0.22) 0%, #111715 100%)");
assert.equal(darkVars["--page-hero-mask-bg"], "radial-gradient(100% 120% at 50% -30%, transparent 46%, rgba(24, 32, 29, 0.16) 53%, rgba(24, 32, 29, 0.42) 62%, rgba(24, 32, 29, 0.76) 75%, #18201d 90%)");
assert.equal(darkVars["--page-hero-orb-bg"], "rgba(24, 32, 29, 0.42)");
assert.equal(darkVars["--page-secondary-soft-bg"], "radial-gradient(circle at top right, rgba(143, 191, 140, 0.2), transparent 34%), linear-gradient(180deg, #111715 0%, #111715 100%)");
assert.equal(darkVars["--page-edge-fade-bg"], "linear-gradient(90deg, rgba(24, 32, 29, 0.16), #111715 28%)");
assert.equal(darkVars["--page-ambient-primary-bg"], "radial-gradient(circle at 82% 84%, rgba(90, 157, 144, 0.14) 0, transparent 34%), linear-gradient(180deg, #111715 0%, #111715 100%)");
assert.equal(darkVars["--page-ambient-duo-bg"], "radial-gradient(circle at 14% 18%, rgba(90, 157, 144, 0.14) 0, transparent 31%), radial-gradient(circle at 80% 14%, rgba(143, 191, 140, 0.13) 0, transparent 28%), linear-gradient(180deg, rgb(24, 31, 29) 0%, #111715 100%)");
assert.equal(darkVars["--page-hero-shell-bg"], "linear-gradient(180deg, rgba(24, 32, 29, 0.16), rgba(24, 32, 29, 0.42)), radial-gradient(circle at 16% 18%, rgb(32, 47, 43) 0, transparent 32%), radial-gradient(circle at 86% 12%, rgba(143, 191, 140, 0.2) 0, transparent 30%), linear-gradient(148deg, rgba(90, 157, 144, 0.22) 0%, rgb(37, 44, 41) 100%)");
assert.equal(
  darkVars["--page-bottom-mask-image"],
  "radial-gradient(ellipse at 15% 100%, #000 0%, rgba(0, 0, 0, 0.76) 36%, transparent 72%), radial-gradient(ellipse at 85% 100%, #000 0%, rgba(0, 0, 0, 0.76) 36%, transparent 72%), linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.42) 50%, #000 100%)"
);
assert.equal(darkVars["--page-overlay-veil-bg"], "linear-gradient(180deg, rgba(24, 32, 29, 0.42) 0%, rgba(24, 32, 29, 0.76) 58%, #111715 100%)");
assert.equal(darkVars["--page-overlay-veil-filter"], "saturate(180%) blur(22rpx)");
assert.equal(darkVars["--page-glow-cluster-start-bg"], "radial-gradient(circle at 68% 14%, rgba(90, 157, 144, 0.22) 0%, transparent 34%), radial-gradient(circle at 22% 34%, rgba(90, 157, 144, 0.22) 0%, transparent 38%), radial-gradient(circle at 60% 58%, rgba(90, 157, 144, 0.22) 0%, transparent 36%), radial-gradient(circle at 28% 84%, rgba(90, 157, 144, 0.22) 0%, transparent 32%)");
assert.equal(darkVars["--page-glow-cluster-end-bg"], "radial-gradient(circle at 34% 12%, rgba(90, 157, 144, 0.22) 0%, transparent 34%), radial-gradient(circle at 76% 36%, rgba(90, 157, 144, 0.22) 0%, transparent 38%), radial-gradient(circle at 36% 62%, rgba(90, 157, 144, 0.22) 0%, transparent 36%), radial-gradient(circle at 70% 86%, rgba(90, 157, 144, 0.22) 0%, transparent 34%)");
assert.equal(
  darkVars["--page-cover-fresh-shell-bg"],
  "linear-gradient(180deg, rgba(24, 32, 29, 0.16) 0%, rgba(24, 32, 29, 0.42) 100%), linear-gradient(140deg, rgb(32, 47, 43) 0%, rgb(37, 44, 41) 48%, #18201d 100%)"
);
assert.equal(darkVars["--overlay-hero-banner-shade"], "linear-gradient(180deg, rgb(9, 14, 13), rgb(5, 8, 8)), radial-gradient(circle at right top, rgba(255, 255, 255, 0.14), transparent 36%)");
assert.equal(darkVars["--color-cover-empty-warm-bg"], "radial-gradient(circle at top right, rgba(143, 191, 140, 0.2), transparent 40%), linear-gradient(135deg, rgb(33, 50, 45), rgb(66, 57, 33))");
assert.equal(darkVars["--color-illustration-panel-accent"], "linear-gradient(145deg, rgba(143, 191, 140, 0.2) 0%, #202926 100%)");
assert.equal(darkVars["--shadow-illustration-dot"], "6rpx -6rpx 0 -2rpx rgba(143, 191, 140, 0.13)");
assert.equal(forcedMonoVars["--color-secondary"], "rgb(184, 215, 131)");
assert.equal(forcedMonoVars["--button-primary-gradient-end"], "rgb(184, 215, 131)");
assert.equal(forcedMonoVars["--feedback-line-primary"], "linear-gradient(90deg, #8dbf3c 0%, rgb(184, 215, 131) 100%)");

console.log("theme vars tests passed");
