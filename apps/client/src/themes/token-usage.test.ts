import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE_DIRS = [
  resolve(__dirname, "../components"),
  resolve(__dirname, "../pages"),
  resolve(__dirname, "../pages_home"),
  resolve(__dirname, "../pages_me"),
  resolve(__dirname, "../pages_meal"),
  resolve(__dirname, "../pages_pantry"),
  resolve(__dirname, "../pages_recipe"),
  resolve(__dirname, "../pages_share"),
  resolve(__dirname, "../pages_web")
] as const;
const THEME_COLORS_FILE = resolve(__dirname, "../styles/colors.scss");
const ENV_CONFIG_FILE = resolve(__dirname, "../config/env.ts");
const CLIENT_README_FILE = resolve(__dirname, "../../README.md");

const DISALLOWED_TOKENS = [
  "var(--theme-",
  "var(--color-raw-",
  "var(--button-primary-gradient-start",
  "var(--button-primary-gradient-end",
  "var(--entry-",
  "var(--color-warning)",
  "var(--color-warning-soft)",
  "var(--color-warning-text)",
  "var(--color-warning-soft-fill)",
  "var(--color-warning-soft-fill-strong)",
  "var(--color-danger)",
  "var(--color-danger-soft)",
  "var(--color-danger-text)",
  "var(--color-danger-soft-fill)",
  "var(--color-danger-soft-fill-strong)",
  "var(--color-success)",
  "var(--color-success-soft)",
  "var(--color-success-text)",
  "var(--color-success-soft-fill)",
  "var(--color-success-contrast)",
  "var(--color-success-button-bg)",
  "var(--color-success-button-text)",
  "var(--color-info)",
  "var(--color-info-soft)",
  "var(--color-info-text)",
  "var(--color-info-soft-fill)",
  "var(--color-info-contrast)",
  "var(--color-info-button-bg)",
  "var(--color-info-button-text)",
  "var(--color-warning-contrast)",
  "var(--color-warning-button-bg)",
  "var(--color-warning-button-text)",
  "var(--color-danger-contrast)",
  "var(--color-danger-button-bg)",
  "var(--color-danger-button-text)",
  "var(--color-text-muted)"
] as const;
const DIRECT_THEME_SEED_TOKEN_PATTERN = /var\(--color-(?:primary|secondary)[A-Za-z0-9-]*\)/g;
const DIRECT_COLOR_PATTERN = /(^|[^A-Za-z0-9_-])(#[0-9A-Fa-f]{3,8}\b|rgba?\(\s*\d)/g;
const CSS_VAR_DEFINITION_PATTERN = /^\s*(--[A-Za-z0-9-]+):/gm;
const DISALLOWED_SHARED_MATERIAL_BORDER_PATTERNS = [
  /\bborder:\s*1rpx\s+solid\s+var\(--material-card-border\)/g,
  /\bborder:\s*1rpx\s+solid\s+var\(--material-panel-border\)/g,
  /\bborder:\s*1rpx\s+solid\s+var\(--material-tabbar-border\)/g,
  /\bborder:\s*1rpx\s+solid\s+var\(--button-primary-border\)/g,
  /\bborder:\s*1rpx\s+solid\s+var\(--button-secondary-border\)/g
] as const;
const DISALLOWED_RAW_FILTER_PATTERNS = [
  /\bfilter:\s*(?!var\()[^;\n]*\bblur\(/g,
  /\b-webkit-backdrop-filter:\s*(?!var\()[^;\n]*\b(?:blur|saturate)\(/g,
  /\bbackdrop-filter:\s*(?!var\()[^;\n]*\b(?:blur|saturate)\(/g
] as const;
const LEGACY_PAGE_META_BINDING = '<page-meta :page-style="pageStyle"';
const DEPRECATED_THEME_SASS_PATTERNS = [
  {
    name: "global mix()",
    pattern: /(^|[^.A-Za-z0-9_-])mix\(/g
  },
  {
    name: "legacy if()",
    pattern: /(^|[^A-Za-z0-9_-])if\(/g
  }
] as const;

const ALLOWED_LOCAL_CSS_VARS = [
  {
    file: resolve(__dirname, "../pages/me/index.vue"),
    tokens: ["--profile-hero-padding-top"]
  },
  {
    file: resolve(__dirname, "../components/NavBar/NavBar.vue"),
    tokens: ["--navbar-side-width", "--navbar-capsule-width"]
  },
  {
    file: resolve(__dirname, "../pages_recipe/detail/index.vue"),
    tokens: ["--nutrition-ring-size", "--nutrition-ring-thickness", "--nutrition-ring-radius"]
  }
] as const;

type AllowedDirectThemeSeedRule = {
  file: string;
  tokens: readonly string[];
};

const ALLOWED_DIRECT_THEME_SEED_TOKENS: readonly AllowedDirectThemeSeedRule[] = [];

const DISALLOWED_LOCAL_THEME_ALIASES = [
  {
    file: resolve(__dirname, "../pages/home/index.vue"),
    tokens: [
      "--home-hero-bg",
      "--home-hero-banner-bg",
      "--home-hero-action-bg",
      "--home-hero-banner-shade",
      "--home-recent-panel-bg",
      "--home-recent-back-bg"
    ]
  },
  {
    file: resolve(__dirname, "../pages_home/topic/index.vue"),
    tokens: ["--plan-queue-badge-bg"]
  },
  {
    file: resolve(__dirname, "../pages_me/knowledge-list/index.vue"),
    tokens: ["--knowledge-list-page-bg"]
  },
  {
    file: resolve(__dirname, "../pages_me/knowledge-detail/index.vue"),
    tokens: ["--knowledge-detail-hero-mask"]
  },
  {
    file: resolve(__dirname, "../pages_me/recommend/index.vue"),
    tokens: ["--recommend-page-bg", "--recommend-icon-shell-bg", "--shopping-icon-shell-bg"]
  },
  {
    file: resolve(__dirname, "../pages_me/phone/index.vue"),
    tokens: ["--phone-page-bg"]
  },
  {
    file: resolve(__dirname, "../pages/me/index.vue"),
    tokens: ["--me-card-shadow", "--profile-hero-end"]
  },
  {
    file: resolve(__dirname, "../pages_pantry/index/index.vue"),
    tokens: ["--pantry-hero-end"]
  },
  {
    file: resolve(__dirname, "../pages_pantry/list-detail/index.vue"),
    tokens: [
      "--pantry-page-bg",
      "--pantry-nav-backdrop-bg",
      "--detail-hero-end",
      "--panel-action-text",
      "--panel-action-outline",
      "--store-card-halo",
      "--store-card-panel",
      "--store-card-outline",
      "--item-origin-divider",
      "--mini-pill-disabled-text",
      "--manage-dock-danger-ring"
    ]
  },
  {
    file: resolve(__dirname, "../pages_pantry/list-complete/index.vue"),
    tokens: [
      "--pantry-page-bg",
      "--pantry-nav-backdrop-bg",
      "--complete-hero-end",
      "--complete-filter-active-bg",
      "--complete-card-pending-shadow",
      "--complete-card-cover-bg",
      "--complete-card-placeholder-bg",
      "--complete-quick-chip-bg",
      "--quantity-sheet-divider"
    ]
  },
  {
    file: resolve(__dirname, "../pages_recipe/detail/index.vue"),
    tokens: ["--detail-step-index-color", "--recipe-detail-page-bg"]
  },
  {
    file: resolve(__dirname, "../pages_meal/detail/index.vue"),
    tokens: [
      "--store-card-halo",
      "--store-card-panel",
      "--store-card-outline",
      "--meal-hero-plan-bg",
      "--meal-hero-cover-empty-bg",
      "--meal-hero-tail-bg"
    ]
  },
  {
    file: resolve(__dirname, "../pages_meal/plan/index.vue"),
    tokens: [
      "--plan-slot-card-bg",
      "--plan-slot-band-bg",
      "--plan-slot-band-outline",
      "--plan-slot-color",
      "--plan-slot-soft"
    ]
  },
  {
    file: resolve(__dirname, "../pages_share/memory/index.vue"),
    tokens: ["--memory-card-bg"]
  }
] as const;

function collectSourceFiles(dir: string, files: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const filePath = resolve(dir, entry);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      collectSourceFiles(filePath, files);
      continue;
    }

    if (!/\.(vue|ts|js|scss)$/.test(filePath) || filePath.endsWith(".test.ts") || filePath.endsWith(".test.js")) {
      continue;
    }

    files.push(filePath);
  }

  return files;
}

const violations: string[] = [];

for (const dir of SOURCE_DIRS) {
  for (const filePath of collectSourceFiles(dir)) {
    const source = readFileSync(filePath, "utf8");

    for (const token of DISALLOWED_TOKENS) {
      if (source.includes(token)) {
        violations.push(`${filePath}: ${token}`);
      }
    }

    for (const match of source.matchAll(DIRECT_COLOR_PATTERN)) {
      violations.push(`${filePath}: direct-color ${match[2]}`);
    }

    const allowedDirectThemeSeedTokens: readonly string[] =
      ALLOWED_DIRECT_THEME_SEED_TOKENS.find((rule) => rule.file === filePath)?.tokens ?? [];

    for (const match of source.matchAll(DIRECT_THEME_SEED_TOKEN_PATTERN)) {
      const token = match[0];

      if (!allowedDirectThemeSeedTokens.includes(token)) {
        violations.push(`${filePath}: direct-theme-seed-token ${token}`);
      }
    }

    for (const pattern of DISALLOWED_SHARED_MATERIAL_BORDER_PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        violations.push(`${filePath}: disallowed-shared-material-border ${match[0]}`);
      }
    }

    for (const pattern of DISALLOWED_RAW_FILTER_PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        violations.push(`${filePath}: raw-filter ${match[0]}`);
      }
    }

    if (filePath.includes("/pages") && source.includes(LEGACY_PAGE_META_BINDING)) {
      violations.push(`${filePath}: legacy-page-meta-binding ${LEGACY_PAGE_META_BINDING}`);
    }

    const allowedVarNames: readonly string[] =
      ALLOWED_LOCAL_CSS_VARS.find((rule) => rule.file === filePath)?.tokens ?? [];

    for (const match of source.matchAll(CSS_VAR_DEFINITION_PATTERN)) {
      const token = match[1];

      if (!allowedVarNames.includes(token)) {
        violations.push(`${filePath}: local-css-var ${token}`);
      }
    }
  }
}

for (const rule of DISALLOWED_LOCAL_THEME_ALIASES) {
  const source = readFileSync(rule.file, "utf8");

  for (const token of rule.tokens) {
    if (source.includes(token)) {
      violations.push(`${rule.file}: ${token}`);
    }
  }
}

const themeColorSource = readFileSync(THEME_COLORS_FILE, "utf8");
const envConfigSource = readFileSync(ENV_CONFIG_FILE, "utf8");
const clientReadmeSource = readFileSync(CLIENT_README_FILE, "utf8");

if (/from\s+["']console["']/.test(envConfigSource)) {
  violations.push(`${ENV_CONFIG_FILE}: env config must not import Node console`);
}

if (/const mode:\s*AppMode\s*=\s*["']dev["']/.test(clientReadmeSource)) {
  violations.push(`${CLIENT_README_FILE}: README must document VITE_APP_MODE scripts instead of manual env.ts editing`);
}

for (const { name, pattern } of DEPRECATED_THEME_SASS_PATTERNS) {
  for (const match of themeColorSource.matchAll(pattern)) {
    violations.push(`${THEME_COLORS_FILE}: deprecated-sass ${name} ${match[0].trim()}`);
  }
}

assert.deepEqual(
  violations,
  [],
  `Pages/components must not reference source-layer theme tokens directly:\n${violations.join("\n")}`
);

console.log("theme token usage tests passed");
