/*
 * 主题配置使用说明
 *
 * 新增皮肤需要改三处：
 * 1. 先在 `src/themes/presets.ts` 增加主题能力和源头色定义。
 * 2. 新建 `src/themes/{skinId}/skins.scss`。
 * 3. 在 `src/themes/skins.scss` 里显式 `@use` 新皮肤样式文件。
 *
 * 源头色和能力声明都只放在 `src/themes/presets.ts`，不要在这里重复定义。
 * `seed` 语义固定为：`primary` 必填、`accent` 可选。
 * `--button-primary-gradient-start/end` 只是按钮层 token，运行态会由 `primary/accent` 映射生成，
 * 不要反过来把 start/end 当成一级主题源头。
 *
 * 新增 `icon` 字体图标皮肤：
 * 1. 在 `src/themes/{skinId}/skins.scss` 中注册本地字体文件和 icon class。
 * 2. 必须提供三个固定 class：`icon-home`、`icon-recipe`、`icon-me`。
 * 3. 在 `src/themes/presets.ts` 中设置 `assetType: "icon"`。
 * 4. 在 `src/themes/skins.scss` 中添加 `@use "./{skinId}/skins.scss" as {skinId}Skin;`。
 * 5. 字体图标会跟随 CSS `color` 变色，适合支持换色或暗黑模式的主题。
 *
 * 新增 SVG 图片皮肤：
 * 1. 新建 `src/themes/{skinId}/skins.scss`。
 * 2. 在同一目录放入固定命名的 SVG：
 *    `home.svg`、`home-active.svg`、`recipe.svg`、`recipe-active.svg`、`me.svg`、`me-active.svg`。
 * 3. 在 `src/themes/presets.ts` 中设置 `assetType: "svg"`。
 * 4. 在 `src/themes/skins.scss` 中添加 `@use "./{skinId}/skins.scss" as {skinId}Skin;`。
 * 5. SVG 颜色来自图片文件本身，适合固定插画、多色、不可简单换色的皮肤。
 *
 * 目录约束：
 * 1. 全局基础变量放在 `src/styles/colors.scss`。
 * 2. 默认皮肤的可切换色系放在 `src/themes/default/skins.scss`。
 * 3. 主题公共逻辑只放在 `src/themes/config.ts`、`src/themes/index.ts`。
 * 4. 皮肤包直接使用 `src/themes/{skinId}/`，不要再加 `skins/`、`template/`、`assets/` 这类中间目录。
 * 5. 正式小程序运行态不要依赖远程 iconfont/CDN，字体文件需要下载到本地皮肤目录。
 * 6. 小程序构建不会把 TS 中的 SCSS import 稳定合并到全局 wxss，因此皮肤样式必须通过 `themes/skins.scss` 显式 @use。
 */
const tabbarSvgModules = import.meta.glob<string>("./*/*.svg", {
  eager: true,
  import: "default"
});

import {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SKIN,
  FALLBACK_ASSET_SKIN,
  THEME_PALETTE_OPTIONS,
  THEME_SKIN_PRESETS,
  THEME_TABBAR_ICON_NAMES,
  type ThemeAssetType,
  type ThemeMode,
  type ThemePalette,
  type ThemeSeed,
  type ThemeSeedSet,
  type ThemeSkin,
  type ThemeSkinAccess,
  type ThemeSkinPreset,
  type ThemeTabbarIconName
} from "./presets";

export interface ThemeSvgAsset {
  type: "svg";
  default: string;
  active: string;
}

export interface ThemeIconAsset {
  type: "icon";
  className: string;
}

export type ThemeTabbarAsset = ThemeSvgAsset | ThemeIconAsset;

export interface ThemeAssets {
  tabbar?: Partial<Record<ThemeTabbarIconName, ThemeTabbarAsset>>;
}

export interface ThemeSkinOption {
  value: ThemeSkin;
  label: string;
  access: ThemeSkinAccess;
  assetType: ThemeAssetType;
  supportsPalette: boolean;
  supportsDark: boolean;
  palettes: ThemePalette[];
  seeds: Partial<Record<ThemePalette, ThemeSeedSet>>;
  assets: ThemeAssets;
}

const FONT_TABBAR_CLASS_BY_NAME: Record<ThemeTabbarIconName, string> = {
  home: "icon-home",
  recipe: "icon-recipe",
  me: "icon-me"
};

function createIconTabbarAssets(): Record<ThemeTabbarIconName, ThemeIconAsset> {
  return THEME_TABBAR_ICON_NAMES.reduce(
    (assets, iconName) => {
      assets[iconName] = {
        type: "icon",
        className: FONT_TABBAR_CLASS_BY_NAME[iconName]
      };
      return assets;
    },
    {} as Record<ThemeTabbarIconName, ThemeIconAsset>
  );
}

function getTabbarSvgPath(skin: string, iconName: ThemeTabbarIconName, active: boolean) {
  return `./${skin}/${iconName}${active ? "-active" : ""}.svg`;
}

function createSvgTabbarAssets(skin: string): Partial<Record<ThemeTabbarIconName, ThemeSvgAsset>> {
  return THEME_TABBAR_ICON_NAMES.reduce(
    (assets, iconName) => {
      const defaultIcon = tabbarSvgModules[getTabbarSvgPath(skin, iconName, false)];
      const activeIcon = tabbarSvgModules[getTabbarSvgPath(skin, iconName, true)];

      if (defaultIcon && activeIcon) {
        assets[iconName] = {
          type: "svg",
          default: defaultIcon,
          active: activeIcon
        };
      }

      return assets;
    },
    {} as Partial<Record<ThemeTabbarIconName, ThemeSvgAsset>>
  );
}

function createThemeAssets(config: ThemeSkinPreset): ThemeAssets {
  return {
    tabbar: config.assetType === "svg" ? createSvgTabbarAssets(config.value) : createIconTabbarAssets()
  };
}

export const THEME_SKIN_OPTIONS: ThemeSkinOption[] = THEME_SKIN_PRESETS.map((config) => ({
  value: config.value,
  label: config.label,
  access: config.access,
  assetType: config.assetType,
  supportsPalette: config.supportsPalette,
  supportsDark: config.supportsDark,
  palettes: [...config.palettes],
  seeds: config.seeds,
  assets: createThemeAssets(config)
}));

export {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SKIN,
  FALLBACK_ASSET_SKIN,
  THEME_PALETTE_OPTIONS,
  THEME_TABBAR_ICON_NAMES
};

export type { ThemeAssetType, ThemeMode, ThemePalette, ThemeSeed, ThemeSeedSet, ThemeSkin, ThemeSkinAccess, ThemeTabbarIconName };
