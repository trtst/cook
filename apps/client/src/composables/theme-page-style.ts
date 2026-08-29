export function buildThemePageStyle(themeVars: Record<string, string>, baseStyle = "overflow: visible;") {
  const backgroundColor = themeVars["--color-page"];
  if (!backgroundColor) return baseStyle;
  return `${baseStyle} background-color: ${backgroundColor};`;
}
