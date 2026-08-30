import type { ThemeSeed, ThemeSourceMode } from "@/themes/presets";

type EffectiveTheme = "light" | "dark";
type ThemeVars = Record<string, string>;

export type ThemeColorSeed = ThemeSeed;

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseColor(color: string) {
  const value = color.trim();

  if (value.startsWith("#")) {
    const hex = value.slice(1);

    if (hex.length === 3) {
      return {
        r: Number.parseInt(hex[0] + hex[0], 16),
        g: Number.parseInt(hex[1] + hex[1], 16),
        b: Number.parseInt(hex[2] + hex[2], 16),
        a: 1
      };
    }

    if (hex.length === 4) {
      return {
        r: Number.parseInt(hex[0] + hex[0], 16),
        g: Number.parseInt(hex[1] + hex[1], 16),
        b: Number.parseInt(hex[2] + hex[2], 16),
        a: Number.parseInt(hex[3] + hex[3], 16) / 255
      };
    }

    if (hex.length === 6 || hex.length === 8) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
      };
    }
  }

  const rgbaMatch = value.match(/rgba?\(([^)]+)\)/i);
  if (!rgbaMatch) return null;

  const parts = rgbaMatch[1]?.split(",").map((part) => part.trim()) ?? [];
  if (parts.length < 3) return null;

  const r = Number.parseFloat(parts[0] ?? "");
  const g = Number.parseFloat(parts[1] ?? "");
  const b = Number.parseFloat(parts[2] ?? "");
  const a = parts[3] == null ? 1 : Number.parseFloat(parts[3]);

  if ([r, g, b, a].some((item) => Number.isNaN(item))) return null;

  return { r, g, b, a };
}

function toRgba(color: string, alpha: number) {
  const parsed = parseColor(color);
  if (!parsed) return color;

  return `rgba(${clampChannel(parsed.r)}, ${clampChannel(parsed.g)}, ${clampChannel(parsed.b)}, ${alpha})`;
}

function mixColor(base: string, overlay: string, weight: number) {
  const baseColor = parseColor(base);
  const overlayColor = parseColor(overlay);

  if (!baseColor || !overlayColor) {
    return weight >= 0.5 ? overlay : base;
  }

  const overlayWeight = Math.max(0, Math.min(1, weight));
  const baseWeight = 1 - overlayWeight;

  return `rgb(${clampChannel(baseColor.r * baseWeight + overlayColor.r * overlayWeight)}, ${clampChannel(
    baseColor.g * baseWeight + overlayColor.g * overlayWeight
  )}, ${clampChannel(baseColor.b * baseWeight + overlayColor.b * overlayWeight)})`;
}

function getContrastText(color: string) {
  const parsed = parseColor(color);
  if (!parsed) return "#ffffff";

  const luminance = (parsed.r * 299 + parsed.g * 587 + parsed.b * 114) / 1000;
  return luminance >= 164 ? "#1b1b1b" : "#ffffff";
}

function deriveSecondary(seed: ThemeColorSeed, themeMode: EffectiveTheme, sourceMode: ThemeSourceMode) {
  if (sourceMode === "duo" && seed.secondary) return seed.secondary;

  return mixColor(seed.primary, themeMode === "dark" ? seed.text : seed.surface, themeMode === "dark" ? 0.3 : 0.38);
}

function deriveSurfaceSoft(seed: ThemeColorSeed, themeMode: EffectiveTheme) {
  return mixColor(seed.surface, seed.primary, themeMode === "dark" ? 0.18 : 0.06);
}

export function buildThemeVars(seed: ThemeColorSeed, themeMode: EffectiveTheme, sourceMode: ThemeSourceMode): ThemeVars {
  if (sourceMode === "duo" && !seed.secondary) {
    throw new Error("duo theme requires secondary seed");
  }

  const secondary = deriveSecondary(seed, themeMode, sourceMode);
  const panel = mixColor(seed.surface, seed.primary, themeMode === "dark" ? 0.12 : 0.08);
  const surfaceSoft = deriveSurfaceSoft(seed, themeMode);
  const secondaryText = toRgba(seed.text, themeMode === "dark" ? 0.72 : 0.7);
  const tertiaryText = toRgba(seed.text, themeMode === "dark" ? 0.58 : 0.56);
  const disabledText = toRgba(seed.text, themeMode === "dark" ? 0.38 : 0.32);
  const inverseText = getContrastText(seed.text);
  const inverseTextStrong = toRgba(inverseText, 0.92);
  const inverseTextMuted = toRgba(inverseText, 0.84);
  const maskSolid = "#000";
  const maskStrong = toRgba(maskSolid, 0.76);
  const maskMid = toRgba(maskSolid, 0.42);
  const border = toRgba(seed.primary, themeMode === "dark" ? 0.14 : 0.12);
  const borderLight = toRgba(seed.primary, themeMode === "dark" ? 0.1 : 0.08);
  const divider = toRgba(seed.primary, themeMode === "dark" ? 0.1 : 0.08);
  const primarySoft = toRgba(seed.primary, themeMode === "dark" ? 0.22 : 0.18);
  const secondarySoft = toRgba(secondary, themeMode === "dark" ? 0.2 : 0.18);
  const primaryHalo = toRgba(seed.primary, themeMode === "dark" ? 0.14 : 0.11);
  const secondaryHalo = toRgba(secondary, themeMode === "dark" ? 0.13 : 0.1);
  const warningHalo = toRgba("#d9902f", themeMode === "dark" ? 0.16 : 0.15);
  const dangerHalo = toRgba("#f47c35", themeMode === "dark" ? 0.14 : 0.11);
  const shimmerStrong = toRgba(themeMode === "dark" ? seed.text : seed.surface, themeMode === "dark" ? 0.14 : 0.42);
  const shimmerSoft = toRgba(themeMode === "dark" ? seed.text : seed.surface, themeMode === "dark" ? 0.08 : 0.18);
  const overlayShadow = toRgba(themeMode === "dark" ? "#000000" : seed.text, themeMode === "dark" ? 0.28 : 0.18);
  const surfaceRaised = mixColor(seed.surface, themeMode === "dark" ? seed.text : "#ffffff", themeMode === "dark" ? 0.06 : 0.12);
  const primarySelected = mixColor(primarySoft, themeMode === "dark" ? seed.surface : "#ffffff", themeMode === "dark" ? 0.14 : 0.28);
  const surfaceSoftCard = mixColor(seed.surface, surfaceSoft, 0.18);
  const surfaceSoftPanel = mixColor(seed.surface, surfaceSoft, 0.12);
  const surfaceSoftMuted = mixColor(seed.surface, surfaceSoft, 0.22);
  const surfaceOverlay = mixColor(seed.surface, seed.bg, 0.08);
  const surfaceOverlaySoft = mixColor(seed.surface, seed.bg, 0.06);
  const surfaceOverlayWeak = mixColor(seed.surface, seed.bg, 0.1);
  const primarySoftFill = mixColor(primarySoft, seed.surface, themeMode === "dark" ? 0.72 : 0.72);
  const primarySoftFillMedium = mixColor(primarySoft, seed.surface, themeMode === "dark" ? 0.68 : 0.68);
  const primarySoftFillSubtle = mixColor(primarySoft, seed.surface, themeMode === "dark" ? 0.58 : 0.58);
  const primarySoftFillStrong = mixColor(primarySoft, seed.surface, themeMode === "dark" ? 0.84 : 0.84);
  const primarySoftFillSoft = mixColor(primarySoft, seed.surface, themeMode === "dark" ? 0.56 : 0.56);
  const primarySoftFillWeak = mixColor(primarySoft, seed.surface, themeMode === "dark" ? 0.42 : 0.42);
  const surfacePrimaryPanel = mixColor(seed.surface, primarySoft, themeMode === "dark" ? 0.18 : 0.18);
  const surfacePrimaryPanelSoft = mixColor(seed.surface, primarySoft, themeMode === "dark" ? 0.14 : 0.14);
  const warningSoftFill = mixColor(toRgba("#d9902f", themeMode === "dark" ? 0.22 : 0.22), seed.surface, themeMode === "dark" ? 0.78 : 0.78);
  const warningSoftFillStrong = mixColor(toRgba("#d9902f", themeMode === "dark" ? 0.22 : 0.22), seed.surface, themeMode === "dark" ? 0.68 : 0.68);
  const dangerSoftFill = mixColor(toRgba("#f47c35", themeMode === "dark" ? 0.22 : 0.18), seed.surface, themeMode === "dark" ? 0.72 : 0.72);
  const dangerSoftFillStrong = mixColor(toRgba("#f47c35", themeMode === "dark" ? 0.22 : 0.18), seed.surface, themeMode === "dark" ? 0.78 : 0.78);
  const successBase = themeMode === "dark" ? "#6eca94" : "#216e4e";
  const warningBase = "#d9902f";
  const dangerBase = "#f47c35";
  const infoBase = "#326fa8";
  const stateWarningCardBg = `radial-gradient(circle at 100% 0%, ${warningHalo} 0 26%, transparent 27%), linear-gradient(135deg, ${warningSoftFill} 0%, ${surfaceSoftCard} 100%)`;
  const statePrimaryCardBg = `radial-gradient(circle at 100% 0%, ${primaryHalo} 0 26%, transparent 27%), linear-gradient(135deg, ${primarySoftFillSubtle} 0%, ${surfaceSoftCard} 100%)`;
  const stateDangerCardBg = `radial-gradient(circle at 100% 0%, ${dangerHalo} 0 26%, transparent 27%), linear-gradient(135deg, ${dangerSoftFill} 0%, ${surfaceSoftCard} 100%)`;
  const successSoftFill = mixColor(toRgba("#216e4e", themeMode === "dark" ? 0.22 : 0.18), seed.surface, themeMode === "dark" ? 0.78 : 0.78);
  const infoSoftFill = mixColor(toRgba("#326fa8", themeMode === "dark" ? 0.22 : 0.16), seed.surface, themeMode === "dark" ? 0.84 : 0.84);
  const photoPlate = mixColor(seed.surface, seed.bg, 0.4);
  const overlayBase = mixColor(seed.bg, seed.primary, themeMode === "dark" ? 0.14 : 0.1);
  const overlayStrong = mixColor(overlayBase, "#000000", themeMode === "dark" ? 0.7 : 0.78);
  const overlayMedium = mixColor(overlayBase, "#000000", themeMode === "dark" ? 0.66 : 0.72);
  const overlayStage = mixColor(overlayBase, "#000000", themeMode === "dark" ? 0.8 : 0.86);
  const overlayText = "#ffffff";
  const overlayTextMuted = toRgba("#ffffff", 0.84);
  const overlayLine = toRgba("#ffffff", themeMode === "dark" ? 0.64 : 0.72);
  const overlayControl = toRgba("#ffffff", themeMode === "dark" ? 0.14 : 0.1);
  const overlaySheenTop = toRgba("#ffffff", themeMode === "dark" ? 0.04 : 0.02);
  const overlaySheenBottom = toRgba("#ffffff", themeMode === "dark" ? 0.02 : 0.01);
  const overlayScrim = toRgba("#000000", themeMode === "dark" ? 0.48 : 0.56);
  const overlayImageMask = `linear-gradient(180deg, ${toRgba("#000000", 0)} 0%, ${toRgba("#000000", themeMode === "dark" ? 0.2 : 0.18)} 28%, ${toRgba(
    "#000000",
    themeMode === "dark" ? 0.9 : 0.92
  )} 100%)`;
  const pageHeroMaskBg = `radial-gradient(100% 120% at 50% -30%, transparent 46%, ${toRgba(seed.surface, 0.16)} 53%, ${toRgba(seed.surface, 0.42)} 62%, ${toRgba(
    seed.surface,
    0.76
  )} 75%, ${seed.surface} 90%)`;
  const pageHeroOrbBg = toRgba(seed.surface, 0.42);
  const pageBottomMaskImage = `radial-gradient(ellipse at 15% 100%, ${maskSolid} 0%, ${maskStrong} 36%, transparent 72%), radial-gradient(ellipse at 85% 100%, ${maskSolid} 0%, ${maskStrong} 36%, transparent 72%), linear-gradient(to bottom, transparent 0%, ${maskMid} 50%, ${maskSolid} 100%)`;
  const pagePrimaryFadeBg = `linear-gradient(180deg, ${primarySoft} 0%, ${seed.bg} 100%)`;
  const pageSecondarySoftBg = `radial-gradient(circle at top right, ${secondarySoft}, transparent 34%), linear-gradient(180deg, ${seed.bg} 0%, ${seed.bg} 100%)`;
  const pageEdgeFadeBg = `linear-gradient(90deg, ${toRgba(seed.surface, 0.16)}, ${seed.bg} 28%)`;
  const pageAmbientPrimaryBg = `radial-gradient(circle at 82% 84%, ${primaryHalo} 0, transparent 34%), linear-gradient(180deg, ${seed.bg} 0%, ${seed.bg} 100%)`;
  const pageAmbientDuoBg = `radial-gradient(circle at 14% 18%, ${primaryHalo} 0, transparent 31%), radial-gradient(circle at 80% 14%, ${secondaryHalo} 0, transparent 28%), linear-gradient(180deg, ${surfaceOverlaySoft} 0%, ${seed.bg} 100%)`;
  const pageHeroBg = `radial-gradient(circle at 16% 18%, ${panel} 0, transparent 32%), radial-gradient(circle at 86% 12%, ${secondarySoft} 0, transparent 30%), linear-gradient(148deg, ${primarySoft} 0%, ${surfaceRaised} 100%)`;
  const pageHeroShellBg = `linear-gradient(180deg, ${toRgba(seed.surface, 0.16)}, ${toRgba(seed.surface, 0.42)}), ${pageHeroBg}`;
  const pageOverlayVeilBg = `linear-gradient(180deg, ${toRgba(seed.surface, 0.42)} 0%, ${toRgba(seed.surface, 0.76)} 58%, ${seed.bg} 100%)`;
  const pageGlowClusterStartBg = `radial-gradient(circle at 68% 14%, ${primarySoft} 0%, transparent 34%), radial-gradient(circle at 22% 34%, ${primarySoft} 0%, transparent 38%), radial-gradient(circle at 60% 58%, ${primarySoft} 0%, transparent 36%), radial-gradient(circle at 28% 84%, ${primarySoft} 0%, transparent 32%)`;
  const pageGlowClusterEndBg = `radial-gradient(circle at 34% 12%, ${primarySoft} 0%, transparent 34%), radial-gradient(circle at 76% 36%, ${primarySoft} 0%, transparent 38%), radial-gradient(circle at 36% 62%, ${primarySoft} 0%, transparent 36%), radial-gradient(circle at 70% 86%, ${primarySoft} 0%, transparent 34%)`;
  const pageCoverFreshShellBg = `linear-gradient(180deg, ${toRgba(seed.surface, 0.16)} 0%, ${toRgba(seed.surface, 0.42)} 100%), linear-gradient(140deg, ${panel} 0%, ${surfaceRaised} 48%, ${seed.surface} 100%)`;
  const materialCardAccentBg = `radial-gradient(circle at top right, ${secondarySoft} 0, transparent 36%), ${surfaceSoftCard}`;
  const overlayHeroBannerShade = `linear-gradient(180deg, ${overlayMedium}, ${overlayStage}), radial-gradient(circle at right top, ${overlayControl}, transparent 36%)`;
  const coverEmptyWarmBg = `radial-gradient(circle at top right, ${secondarySoft}, transparent 40%), linear-gradient(135deg, ${surfacePrimaryPanelSoft}, ${warningSoftFill})`;
  const illustrationPanelSurface = themeMode === "dark" ? "#202926" : surfaceRaised;
  const illustrationPanelWarm = `linear-gradient(145deg, ${primarySoft} 0%, ${illustrationPanelSurface} 100%)`;
  const illustrationPanelFresh = `linear-gradient(145deg, ${panel} 0%, ${illustrationPanelSurface} 100%)`;
  const illustrationPanelAccent = `linear-gradient(145deg, ${secondarySoft} 0%, ${illustrationPanelSurface} 100%)`;
  const shadowIllustration = `0 8rpx 20rpx ${toRgba(seed.primary, themeMode === "dark" ? 0.14 : 0.1)}`;
  const shadowIllustrationDot = `6rpx -6rpx 0 -2rpx ${secondaryHalo}`;
  const loginHeroShadow = toRgba(themeMode === "dark" ? "#000000" : mixColor(seed.text, seed.primary, 0.22), themeMode === "dark" ? 0.18 : 0.08);
  const frostedMask = `linear-gradient(180deg, transparent 0%, ${toRgba("#000000", 0.1)} 36%, ${toRgba("#000000", 1)} 100%)`;
  const feedbackGlowStart = toRgba(themeMode === "dark" ? seed.text : seed.surface, 0);
  const feedbackPrimaryLine = `linear-gradient(90deg, ${seed.primary} 0%, ${secondary} 100%)`;
  const feedbackDangerLine = "linear-gradient(90deg, var(--color-state-danger-base) 0%, var(--color-state-warning-base) 100%)";
  const primaryActive = mixColor(seed.primary, seed.text, themeMode === "dark" ? 0.14 : 0.12);
  const secondaryActive = mixColor(secondary, seed.text, themeMode === "dark" ? 0.16 : 0.12);
  const buttonText = getContrastText(seed.primary);
  const secondaryTextOnColor = getContrastText(secondary);
  const dangerButtonText = getContrastText(dangerBase);
  const notificationBadgeText = getContrastText(dangerBase);
  const iconSecondary = tertiaryText;
  const buttonSecondaryBg = surfaceSoft;
  const buttonSecondaryText = secondaryText;
  const buttonSecondaryOutline = "transparent";
  const tierFreeBg = `linear-gradient(135deg, ${mixColor(seed.surface, seed.text, themeMode === "dark" ? 0.12 : 0.06)} 0%, ${mixColor(
    seed.surface,
    seed.primary,
    themeMode === "dark" ? 0.08 : 0.04
  )} 100%)`;
  const tierPlusBg = `linear-gradient(135deg, ${mixColor(seed.surface, secondary, themeMode === "dark" ? 0.22 : 0.28)} 0%, ${mixColor(
    secondary,
    "#d9902f",
    themeMode === "dark" ? 0.28 : 0.34
  )} 100%)`;
  const tierProBase = mixColor(seed.text, seed.surface, themeMode === "dark" ? 0.12 : 0.08);
  const tierProMid = mixColor(seed.text, "#121212", 0.42);
  const tierProAccent = mixColor(secondary, "#a97826", themeMode === "dark" ? 0.5 : 0.6);
  const tierUltraBase = mixColor(seed.text, "#0d0d0d", 0.3);
  const tierUltraMid = mixColor(seed.text, "#050505", 0.52);
  const tierUltraAccent = mixColor(secondary, "#d9b35b", themeMode === "dark" ? 0.52 : 0.64);
  const tierProText = getContrastText(tierProMid);
  const tierUltraText = getContrastText(tierUltraMid);
  const breakfast = mixColor(secondary, "#d9902f", themeMode === "dark" ? 0.4 : 0.34);
  const lunch = mixColor(seed.primary, "#216e4e", themeMode === "dark" ? 0.22 : 0.18);
  const afternoonTea = mixColor("#d9902f", "#326fa8", themeMode === "dark" ? 0.3 : 0.28);
  const dinner = mixColor("#f47c35", secondary, themeMode === "dark" ? 0.22 : 0.2);
  const lateNight = mixColor("#326fa8", seed.primary, themeMode === "dark" ? 0.28 : 0.24);

  return {
    "--color-raw-bg": seed.bg,
    "--color-raw-surface": seed.surface,
    "--color-raw-text": seed.text,
    "--color-raw-primary": seed.primary,
    "--color-raw-secondary": secondary,
    "--color-page": seed.bg,
    "--color-surface": seed.surface,
    "--color-surface-soft": surfaceSoft,
    "--color-surface-mask-weak": toRgba(seed.surface, 0.16),
    "--color-surface-mask-medium": toRgba(seed.surface, 0.42),
    "--color-surface-mask-strong": toRgba(seed.surface, 0.76),
    "--color-surface-muted": panel,
    "--color-surface-soft-card": surfaceSoftCard,
    "--color-surface-soft-panel": surfaceSoftPanel,
    "--color-surface-soft-muted": surfaceSoftMuted,
    "--color-surface-overlay": surfaceOverlay,
    "--color-surface-overlay-soft": surfaceOverlaySoft,
    "--color-surface-overlay-weak": surfaceOverlayWeak,
    "--color-surface-muted-frost": toRgba(panel, 0.68),
    "--color-text": seed.text,
    "--color-text-secondary": secondaryText,
    "--color-text-tertiary": tertiaryText,
    "--color-text-disabled": disabledText,
    "--color-text-inverse": inverseText,
    "--color-text-inverse-strong": inverseTextStrong,
    "--color-text-inverse-muted": inverseTextMuted,
    "--color-mask-solid": maskSolid,
    "--color-mask-strong": maskStrong,
    "--color-mask-mid": maskMid,
    "--color-icon": seed.text,
    "--color-icon-secondary": iconSecondary,
    "--color-icon-tertiary": disabledText,
    "--color-icon-active": seed.primary,
    "--color-icon-accent": secondary,
    "--color-primary": seed.primary,
    "--color-primary-foreground": buttonText,
    "--color-primary-active": primaryActive,
    "--color-primary-soft": primarySoft,
    "--color-primary-halo": primaryHalo,
    "--color-primary-contrast": buttonText,
    "--color-secondary": secondary,
    "--color-secondary-soft": secondarySoft,
    "--color-secondary-halo": secondaryHalo,
    "--color-secondary-active": secondaryActive,
    "--color-secondary-contrast": secondaryTextOnColor,
    "--color-tag-neutral-bg": surfaceSoftMuted,
    "--color-tag-neutral-text": secondaryText,
    "--color-tag-primary-bg": primarySoft,
    "--color-tag-primary-text": seed.primary,
    "--color-tag-secondary-bg": secondarySoft,
    "--color-tag-secondary-text": secondaryTextOnColor,
    "--color-tag-success-bg": "var(--color-state-success-soft)",
    "--color-tag-success-text": "var(--color-state-success-text)",
    "--color-tag-warning-bg": "var(--color-state-warning-soft)",
    "--color-tag-warning-text": "var(--color-state-warning-text)",
    "--color-tag-danger-bg": "var(--color-state-danger-soft)",
    "--color-tag-danger-text": "var(--color-state-danger-text)",
    "--color-border": border,
    "--color-border-light": borderLight,
    "--color-border-active": toRgba(seed.primary, 0.24),
    "--color-divider": divider,
    "--color-primary-soft-fill": primarySoftFill,
    "--color-primary-soft-fill-medium": primarySoftFillMedium,
    "--color-primary-soft-fill-subtle": primarySoftFillSubtle,
    "--color-primary-soft-fill-strong": primarySoftFillStrong,
    "--color-primary-soft-fill-soft": primarySoftFillSoft,
    "--color-primary-soft-fill-weak": primarySoftFillWeak,
    "--color-surface-primary-panel": surfacePrimaryPanel,
    "--color-surface-primary-panel-soft": surfacePrimaryPanelSoft,
    "--color-support-info": surfacePrimaryPanel,
    "--color-support-highlight": secondarySoft,
    "--color-support-notice": primarySoftFill,
    "--color-support-action": seed.primary,
    "--color-state-success-base": successBase,
    "--color-state-success-soft": successSoftFill,
    "--color-state-success-text": successBase,
    "--color-state-success-border": toRgba(successBase, themeMode === "dark" ? 0.22 : 0.18),
    "--color-state-warning-base": warningBase,
    "--color-state-warning-soft": warningSoftFill,
    "--color-state-warning-text": warningBase,
    "--color-state-warning-border": toRgba(warningBase, 0.22),
    "--color-state-danger-base": dangerBase,
    "--color-state-danger-soft": dangerSoftFill,
    "--color-state-danger-text": dangerBase,
    "--color-state-danger-border": toRgba(dangerBase, themeMode === "dark" ? 0.22 : 0.18),
    "--color-state-info-base": infoBase,
    "--color-state-info-soft": infoSoftFill,
    "--color-state-info-text": infoBase,
    "--color-state-info-border": toRgba(infoBase, themeMode === "dark" ? 0.22 : 0.16),
    "--color-state-disabled-base": disabledText,
    "--color-state-disabled-soft": surfaceSoftMuted,
    "--color-state-disabled-text": disabledText,
    "--color-state-disabled-border": borderLight,
    "--color-state-warning-card-bg": stateWarningCardBg,
    "--color-state-primary-card-bg": statePrimaryCardBg,
    "--color-state-danger-card-bg": stateDangerCardBg,
    "--color-warning-soft-fill": "var(--color-state-warning-soft)",
    "--color-warning-soft-fill-strong": warningSoftFillStrong,
    "--color-warning-halo": warningHalo,
    "--color-danger-soft-fill": "var(--color-state-danger-soft)",
    "--color-danger-soft-fill-strong": dangerSoftFillStrong,
    "--color-danger-halo": dangerHalo,
    "--color-success-soft-fill": "var(--color-state-success-soft)",
    "--color-info-soft-fill": "var(--color-state-info-soft)",
    "--color-nutrition-fat": "var(--color-state-danger-base)",
    "--color-nutrition-protein": "var(--color-state-warning-base)",
    "--color-nutrition-carbohydrate": "var(--color-state-success-base)",
    "--color-shimmer-strong": shimmerStrong,
    "--color-shimmer-soft": shimmerSoft,
    "--color-shadow-overlay": overlayShadow,
    "--color-surface-raised": surfaceRaised,
    "--color-primary-selected": primarySelected,
    "--color-overlay-strong": overlayStrong,
    "--color-overlay-medium": overlayMedium,
    "--color-overlay-stage": overlayStage,
    "--color-overlay-text": overlayText,
    "--color-overlay-text-muted": overlayTextMuted,
    "--color-overlay-line": overlayLine,
    "--color-overlay-control": overlayControl,
    "--color-overlay-sheen-top": overlaySheenTop,
    "--color-overlay-sheen-bottom": overlaySheenBottom,
    "--color-overlay-scrim": overlayScrim,
    "--overlay-image-mask": overlayImageMask,
    "--login-popup-hero-shadow": loginHeroShadow,
    "--frosted-mask-image": frostedMask,
    "--feedback-glow-start": feedbackGlowStart,
    "--feedback-glow-primary-end": primarySoft,
    "--feedback-glow-danger-end": toRgba("#f47c35", themeMode === "dark" ? 0.22 : 0.18),
    "--feedback-line-primary": feedbackPrimaryLine,
    "--feedback-line-danger": feedbackDangerLine,
    "--color-tabbar-bg": toRgba(seed.surface, 0.92),
    "--shadow-card": `0 2rpx 8rpx ${toRgba(seed.primary, themeMode === "dark" ? 0.1 : 0.06)}`,
    "--shadow-floating": `0 -2rpx 8rpx ${toRgba(seed.primary, themeMode === "dark" ? 0.12 : 0.08)}`,
    "--shadow-tabbar": `0 2rpx 8rpx ${toRgba(seed.primary, themeMode === "dark" ? 0.1 : 0.06)}`,
    "--button-primary-bg": `linear-gradient(135deg, ${seed.primary} 0%, ${secondary} 100%)`,
    "--button-primary-gradient-start": seed.primary,
    "--button-primary-gradient-end": secondary,
    "--button-primary-text": buttonText,
    "--button-primary-shadow": `0 3rpx 10rpx ${toRgba(seed.primary, themeMode === "dark" ? 0.14 : 0.1)}`,
    "--button-primary-border": "transparent",
    "--button-primary-filter": "none",
    "--button-secondary-bg": buttonSecondaryBg,
    "--button-secondary-text": buttonSecondaryText,
    "--button-secondary-outline": buttonSecondaryOutline,
    "--button-secondary-border": "transparent",
    "--button-secondary-filter": "none",
    "--button-danger-bg": dangerBase,
    "--button-danger-text": dangerButtonText,
    "--notification-badge-text": notificationBadgeText,
    "--button-danger-shadow": `0 3rpx 10rpx ${toRgba(dangerBase, themeMode === "dark" ? 0.18 : 0.14)}`,
    "--button-danger-border": "transparent",
    "--button-danger-filter": "none",
    "--material-mask-filter": "saturate(145%) blur(10rpx)",
    "--material-card-bg": "var(--color-surface-soft-card)",
    "--material-card-accent-bg": materialCardAccentBg,
    "--material-card-border": "transparent",
    "--material-card-shadow": "var(--shadow-card)",
    "--material-card-filter": "none",
    "--material-input-bg": seed.surface,
    "--material-input-border": borderLight,
    "--material-input-shadow": "none",
    "--material-input-filter": "none",
    "--material-control-bg": surfaceSoftCard,
    "--material-control-border": "transparent",
    "--material-control-shadow": "none",
    "--material-control-filter": "none",
    "--material-panel-bg": "var(--color-surface-overlay)",
    "--material-panel-border": "transparent",
    "--material-panel-shadow": "var(--shadow-floating)",
    "--material-panel-filter": "none",
    "--material-tabbar-bg": "var(--color-tabbar-bg)",
    "--material-tabbar-border": "transparent",
    "--material-tabbar-shadow": "var(--shadow-tabbar)",
    "--material-tabbar-filter": "saturate(180%) blur(28rpx)",
    "--page-warm-bg": `linear-gradient(180deg, ${mixColor(seed.bg, seed.surface, themeMode === "dark" ? 0.16 : 0.42)} 0%, ${mixColor(seed.bg, secondary, themeMode === "dark" ? 0.08 : 0.1)} 20%, ${seed.bg} 100%)`,
    "--page-primary-soft-bg": `radial-gradient(circle at top right, ${toRgba(seed.primary, themeMode === "dark" ? 0.22 : 0.18)} 0, transparent ${themeMode === "dark" ? "42%" : "36%"}), ${seed.bg}`,
    "--page-primary-fade-bg": pagePrimaryFadeBg,
    "--page-secondary-soft-bg": pageSecondarySoftBg,
    "--page-edge-fade-bg": pageEdgeFadeBg,
    "--page-ambient-primary-bg": pageAmbientPrimaryBg,
    "--page-ambient-duo-bg": pageAmbientDuoBg,
    "--page-hero-bg": pageHeroBg,
    "--page-hero-shell-bg": pageHeroShellBg,
    "--page-hero-halo-bg": `radial-gradient(circle at 78% 16%, ${primarySoft} 0, transparent 34%), radial-gradient(circle at 8% 42%, ${secondarySoft} 0, transparent 30%), linear-gradient(132deg, ${surfaceRaised} 0%, ${panel} 100%)`,
    "--page-hero-mask-bg": pageHeroMaskBg,
    "--page-hero-orb-bg": pageHeroOrbBg,
    "--page-bottom-mask-image": pageBottomMaskImage,
    "--page-overlay-veil-bg": pageOverlayVeilBg,
    "--page-overlay-veil-filter": "saturate(180%) blur(22rpx)",
    "--page-backdrop-blur-filter": "blur(28rpx)",
    "--page-glow-cluster-filter": "blur(24rpx)",
    "--page-glow-cluster-start-bg": pageGlowClusterStartBg,
    "--page-glow-cluster-end-bg": pageGlowClusterEndBg,
    "--page-cover-fresh-shell-bg": pageCoverFreshShellBg,
    "--page-cover-fresh-bg": `linear-gradient(140deg, ${panel} 0%, ${surfaceRaised} 48%, ${seed.surface} 100%)`,
    "--overlay-hero-banner-shade": overlayHeroBannerShade,
    "--color-cover-empty-warm-bg": coverEmptyWarmBg,
    "--color-illustration-ink": themeMode === "dark" ? "#f5efe8" : "#1b1b1b",
    "--color-illustration-plate": photoPlate,
    "--color-illustration-rice": themeMode === "dark" ? "#f4e4c7" : "#fff0d7",
    "--color-illustration-warm": themeMode === "dark" ? "#d9902f" : "#f3b15b",
    "--color-illustration-fresh": mixColor(seed.primary, "#6fb46d", themeMode === "dark" ? 0.42 : 0.28),
    "--color-illustration-sunny": mixColor(secondary, "#f5d76e", themeMode === "dark" ? 0.34 : 0.42),
    "--color-illustration-panel-warm": illustrationPanelWarm,
    "--color-illustration-panel-fresh": illustrationPanelFresh,
    "--color-illustration-panel-accent": illustrationPanelAccent,
    "--shadow-illustration": shadowIllustration,
    "--shadow-illustration-dot": shadowIllustrationDot,
    "--color-illustration-leaf-soft": themeMode === "dark" ? "#8cbf77" : "#d7efc2",
    "--color-illustration-leaf-strong": themeMode === "dark" ? "#67a863" : "#a9d58e",
    "--color-illustration-egg": themeMode === "dark" ? "#f6d57f" : "#ffd87d",
    "--color-illustration-bowl": secondarySoft,
    "--color-illustration-cup": panel,
    "--tier-badge-free-bg": tierFreeBg,
    "--tier-badge-free-text": secondaryText,
    "--tier-badge-plus-bg": tierPlusBg,
    "--tier-badge-plus-text": themeMode === "dark" ? getContrastText(mixColor(secondary, "#d9902f", 0.28)) : "#6d470f",
    "--tier-badge-pro-bg": `linear-gradient(135deg, ${tierProBase} 0%, ${tierProMid} 55%, ${tierProAccent} 100%)`,
    "--tier-badge-pro-text": tierProText,
    "--tier-badge-ultra-bg": `linear-gradient(135deg, ${tierUltraBase} 0%, ${tierUltraMid} 45%, ${tierUltraAccent} 100%)`,
    "--tier-badge-ultra-text": tierUltraText,
    "--meal-slot-breakfast": breakfast,
    "--meal-slot-breakfast-soft": mixColor(seed.surface, breakfast, themeMode === "dark" ? 0.2 : 0.16),
    "--meal-slot-lunch": lunch,
    "--meal-slot-lunch-soft": mixColor(seed.surface, lunch, themeMode === "dark" ? 0.2 : 0.16),
    "--meal-slot-afternoon-tea": afternoonTea,
    "--meal-slot-afternoon-tea-soft": mixColor(seed.surface, afternoonTea, themeMode === "dark" ? 0.2 : 0.16),
    "--meal-slot-dinner": dinner,
    "--meal-slot-dinner-soft": mixColor(seed.surface, dinner, themeMode === "dark" ? 0.2 : 0.16),
    "--meal-slot-late-night": lateNight,
    "--meal-slot-late-night-soft": mixColor(seed.surface, lateNight, themeMode === "dark" ? 0.18 : 0.14),
    "--login-popup-backdrop-bg": toRgba(themeMode === "dark" ? "#050908" : seed.text, themeMode === "dark" ? 0.42 : 0.28),
    "--login-popup-backdrop-filter": "blur(24rpx) saturate(145%)",
    "--login-popup-hero-copy": seed.text,
    "--login-popup-hero-copy-secondary": secondaryText,
    "--login-popup-hero-mask-spot": toRgba(secondary, themeMode === "dark" ? 0.12 : 0.18),
    "--login-popup-hero-mask-top": toRgba(seed.surface, themeMode === "dark" ? 0.06 : 0.04),
    "--login-popup-hero-mask-bottom": toRgba(seed.bg, themeMode === "dark" ? 0.5 : 0.42),
    "--login-popup-sheet-border": "transparent",
    "--login-popup-sheet-shadow": `0 -6rpx 18rpx ${toRgba(seed.primary, themeMode === "dark" ? 0.12 : 0.08)}`,
    "--login-popup-sheet-filter": "blur(28rpx) saturate(150%)",
    "--login-popup-sheet-overlay-start": toRgba(seed.surface, themeMode === "dark" ? 0.78 : 0.74),
    "--login-popup-sheet-overlay-end": toRgba(seed.bg, themeMode === "dark" ? 0.84 : 0.68),
    "--login-popup-title": seed.text,
    "--login-popup-description": secondaryText,
    "--login-popup-input-bg": toRgba(seed.surface, themeMode === "dark" ? 0.16 : 0.92),
    "--login-popup-input-border": border,
    "--login-popup-input-text": seed.text,
    "--login-popup-code-bg": primarySoft,
    "--login-popup-code-text": seed.primary,
    "--login-popup-ghost-bg": toRgba(seed.surface, themeMode === "dark" ? 0.12 : 0.86),
    "--login-popup-ghost-border": border,
    "--login-popup-ghost-text": secondaryText,
    "--login-popup-hint": tertiaryText
  };
}

export type { EffectiveTheme, ThemeVars };
