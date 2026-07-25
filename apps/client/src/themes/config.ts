/*
 * 主题配置使用说明
 *
 * 新增皮肤需要改三处：
 * 1. 新建 `src/themes/{skinId}/skins.scss`。
 * 2. 在 `src/themes/skins.scss` 中 @use 该皮肤样式，确保小程序全局 wxss 能打包。
 * 3. 在下方 `THEME_SKIN_CONFIGS` 增加一条皮肤配置。
 *
 * 新增字体图标皮肤：
 * 1. 在 `src/themes/{skinId}/skins.scss` 中注册本地字体文件和 icon class。
 * 2. 必须提供三个固定 class：`icon-home`、`icon-recipe`、`icon-me`。
 * 3. 在 `src/themes/skins.scss` 中添加 `@use "./{skinId}/skins.scss" as {skinId}Skin;`。
 * 4. 在 `THEME_SKIN_CONFIGS` 中设置 `tabbarAssetType: "font"`。
 * 5. 字体图标会跟随 CSS `color` 变色，适合默认皮肤、免费皮肤和色系切换。
 *
 * 新增 SVG 图片皮肤：
 * 1. 新建 `src/themes/{skinId}/skins.scss`。
 * 2. 在同一目录放入固定命名的 SVG：
 *    `home.svg`、`home-active.svg`、`recipe.svg`、`recipe-active.svg`、`me.svg`、`me-active.svg`。
 * 3. 在 `src/themes/skins.scss` 中添加 `@use "./{skinId}/skins.scss" as {skinId}Skin;`。
 * 4. 在 `THEME_SKIN_CONFIGS` 中设置 `tabbarAssetType: "svg"`。
 * 5. SVG 颜色来自图片文件本身，适合手绘、多色、不可简单换色的皮肤。
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

export type ThemeMode = "system" | "light" | "dark";
export type ThemePalette = (typeof THEME_PALETTE_OPTIONS)[number];
export type ThemeSkin = (typeof THEME_SKIN_CONFIGS)[number]["value"];
export type ThemeSkinAccess = "free" | "member";
export type ThemeTabbarIconName = (typeof THEME_TABBAR_ICON_NAMES)[number];
export type ThemeTabbarAssetType = "font" | "svg";

export interface ThemeSvgAsset {
  type: "svg";
  default: string;
  active: string;
}

export interface ThemeFontAsset {
  type: "font";
  className: string;
}

export type ThemeTabbarAsset = ThemeSvgAsset | ThemeFontAsset;

export interface ThemeAssets {
  tabbar?: Partial<Record<ThemeTabbarIconName, ThemeTabbarAsset>>;
}

export interface ThemeSkinOption {
  value: ThemeSkin;
  label: string;
  access: ThemeSkinAccess;
  palettes: ThemePalette[];
  tabbarAssetType: ThemeTabbarAssetType;
  assets: ThemeAssets;
}

interface ThemeSkinConfig {
  value: string;
  label: string;
  access: ThemeSkinAccess;
  palettes: readonly ThemePalette[];
  tabbarAssetType: ThemeTabbarAssetType;
}

export const THEME_PALETTE_OPTIONS = ["default", "warm", "olive", "cool"] as const;
export const THEME_TABBAR_ICON_NAMES = ["home", "recipe", "me"] as const;
export const DEFAULT_THEME_SKIN: ThemeSkin = "default";
export const DEFAULT_THEME_PALETTE: ThemePalette = "default";
export const FALLBACK_ASSET_SKIN: ThemeSkin = "default";

const FONT_TABBAR_CLASS_BY_NAME: Record<ThemeTabbarIconName, string> = {
  home: "icon-home",
  recipe: "icon-recipe",
  me: "icon-me"
};

const THEME_SKIN_CONFIGS = [
  {
    value: "default",
    label: "基础",
    access: "free",
    palettes: ["default", "warm", "olive", "cool"],
    tabbarAssetType: "svg"
  },
  {
    value: "handdrawn-food",
    label: "手绘食物",
    access: "member",
    palettes: [],
    tabbarAssetType: "svg"
  },
  {
    value: "warm-couple",
    label: "暖黄情侣",
    access: "member",
    palettes: [],
    tabbarAssetType: "font"
  },
  {
    value: "apple-glass",
    label: "苹果高斯",
    access: "member",
    palettes: [],
    tabbarAssetType: "font"
  }
] as const satisfies readonly ThemeSkinConfig[];

function createFontTabbarAssets(): Record<ThemeTabbarIconName, ThemeFontAsset> {
  return THEME_TABBAR_ICON_NAMES.reduce(
    (assets, iconName) => {
      assets[iconName] = {
        type: "font",
        className: FONT_TABBAR_CLASS_BY_NAME[iconName]
      };
      return assets;
    },
    {} as Record<ThemeTabbarIconName, ThemeFontAsset>
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

function createThemeAssets(config: ThemeSkinConfig): ThemeAssets {
  return {
    tabbar: config.tabbarAssetType === "svg" ? createSvgTabbarAssets(config.value) : createFontTabbarAssets()
  };
}

export const THEME_SKIN_OPTIONS: ThemeSkinOption[] = THEME_SKIN_CONFIGS.map((config) => ({
  value: config.value,
  label: config.label,
  access: config.access,
  palettes: [...config.palettes],
  tabbarAssetType: config.tabbarAssetType,
  assets: createThemeAssets(config)
}));
