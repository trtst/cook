# 主题新增检查单

用于 `apps/client` 新增一个可交付主题时的最小接入步骤。

## 先认规则

1. 一级主题源头只认 `bg / surface / text / primary / accent`。
2. `primary` 必填，表示主题高亮色。
3. `accent` 可选，表示次级点缀色；不填时运行态会从 `primary` 自动派生。
4. `--button-primary-gradient-start/end` 只是组件层 token，不是一级主题源头。
5. 普通主题按统一模板接入；`apple-glass` 这种玻璃特例单独处理，不反推成公共规则。

## 步骤 1：在 `presets.ts` 声明主题源头和能力

文件：`apps/client/src/themes/presets.ts`

需要确认的字段：

- `value`：主题 id，目录名和 class 名都跟它保持一致。
- `label`：主题展示名。
- `access`：`free` 或 `member`。
- `assetType`：`icon` 或 `svg`。
- `supportsPalette`：是否支持色系切换。
- `supportsDark`：是否支持暗黑模式。
- `palettes`：支持的 palette 列表；不支持时传空数组。
- `seeds`：每个 palette 下的 `light/dark` 源头色。

双主题色示例：

```ts
{
  value: "new-theme",
  label: "新主题",
  access: "member",
  assetType: "icon",
  supportsPalette: false,
  supportsDark: false,
  palettes: [],
  seeds: {
    default: {
      light: {
        bg: "#f5f7f4",
        surface: "#ffffff",
        text: "#1f2a24",
        primary: "#5f9f86",
        accent: "#f0b16b"
      }
    }
  }
}
```

单主题色示例：

```ts
{
  value: "new-theme",
  label: "新主题",
  access: "member",
  assetType: "icon",
  supportsPalette: false,
  supportsDark: false,
  palettes: [],
  seeds: {
    default: {
      light: {
        bg: "#f5f7f4",
        surface: "#ffffff",
        text: "#1f2a24",
        primary: "#5f9f86"
      }
    }
  }
}
```

说明：

- 只有一个主题色时，`primary` 同时承担高亮色，运行态自动派生 `accent`。
- 需要显式区分“高亮色”和“次级点缀色”时，同时填写 `primary` 和 `accent`。
- `supportsDark: true` 时，补 `dark` seed；否则运行态固定走 `light`。
- `supportsPalette: true` 时，至少补齐 `palettes` 里每个 palette 对应的 seed。

## 步骤 2：新增皮肤目录和 `skins.scss`

目录：`apps/client/src/themes/{skinId}/`

最少新增：

- `skins.scss`

`skins.scss` 只放主题专属表现层：

- 可以放本主题专属的 `entry-*`、局部插画、局部材质、字体图标注册。
- 不要重复声明已经由运行态 `themeVars` 下发的通用语义色。
- 不要把页面局部结构遮罩、业务态颜色随手抬成全局主题变量。

## 步骤 3：准备 tabbar 资源

### `assetType: "icon"`

适用：需要跟随 CSS `color` 换色，或支持暗黑模式。

要求：

1. 字体文件放本地皮肤目录，不依赖远程 iconfont/CDN。
2. 在 `skins.scss` 里注册字体和 class。
3. 必须提供三个固定 class：
   `icon-home`、`icon-recipe`、`icon-me`

### `assetType: "svg"`

适用：固定插画、多色图标、不可简单换色的主题。

要求：

1. SVG 放在 `apps/client/src/themes/{skinId}/`
2. 文件名固定为：
   `home.svg`
   `home-active.svg`
   `recipe.svg`
   `recipe-active.svg`
   `me.svg`
   `me-active.svg`

## 步骤 4：把皮肤样式接入全局主题入口

文件：`apps/client/src/themes/skins.scss`

增加一行：

```scss
@use "./{skinId}/skins.scss" as {skinId}Skin;
```

说明：

- 小程序构建下，皮肤样式必须通过这个入口显式 `@use`。
- 只新增当前皮肤这一行，不顺手重排其他主题文件。

## 步骤 5：页面能力自检

至少检查下面几项：

- 主题在“我的 > 皮肤主题”里能展示和切换。
- tabbar 图标能正常显示。
- `icon` 主题能跟随颜色切换；`svg` 主题保持图片自身颜色。
- 支持暗黑模式的主题，`system/light/dark` 切换结果正确。
- 支持 palette 的主题，palette 切换只影响该主题允许切换的色系。
- 首页、“我的”、登录弹窗没有继续暴露不该存在的固定主题色。

## 最小校验命令

1. `pnpm --filter @next-meal/client type-check`
2. `git diff --check -- apps/client/src/themes docs/templates/theme_add_checklist.md docs/index.md docs/plans/minor_change_log.md`

## 提交前自检

- [ ] 只新增了本主题需要的 preset、skin 和资源
- [ ] 没把 `start/end` 当一级主题源头
- [ ] 没把通用语义色重复写进皮肤 SCSS
- [ ] `icon/svg` 资源命名符合现有约束
- [ ] `supportsPalette`、`supportsDark` 与真实资源能力一致
- [ ] `docs/plans/minor_change_log.md` 已补实际完成记录
