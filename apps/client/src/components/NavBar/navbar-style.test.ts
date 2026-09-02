import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "NavBar.vue"), "utf8");

function expectIncludes(snippet: string) {
  assert.ok(source.includes(snippet), `Expected NavBar to include: ${snippet}`);
}

function expectNotIncludes(snippet: string) {
  assert.ok(!source.includes(snippet), `Expected NavBar not to include: ${snippet}`);
}

function expectSelectorIncludes(selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(match[1].includes(snippet), `Expected selector ${selector} to include: ${snippet}`);
  }
}

expectNotIncludes('"--navbar-side-width": `${navSideGuardWidth.value}px`');
expectNotIncludes("navSideGuardWidth");
expectNotIncludes("--navbar-right-width");
expectNotIncludes("navbar__side--custom-left");
expectNotIncludes("navbar__side--custom-right");
expectNotIncludes("navbar__side--slot-right");
expectNotIncludes("isCustomLeft");
expectNotIncludes("hasRightSlot");
expectNotIncludes("hasLeftSlot");
expectNotIncludes("useSlots");
expectNotIncludes("$slots.left");
expectNotIncludes("$slots.right");
expectIncludes("const { navBarHeight, navBarTotalHeight, navCapsuleWidth, systemInfo } = useSystemInfo();");
expectIncludes('const isMiniProgram = computed(() => uniPlatform.system.getRuntimeChannel() === "mini_program");');
expectNotIncludes("hasCenterSlot");
expectNotIncludes("$slots.d");
expectNotIncludes("$slots.default");
expectNotIncludes('layout?: "title" | "custom-left";');
expectNotIncludes('layout: "title"');
expectIncludes("capsuleGuard?: boolean;");
expectIncludes("capsuleGuard: false");
expectIncludes("customCenter?: boolean;");
expectIncludes("customCenter: false");
expectNotIncludes("leftContent?: boolean;");
expectNotIncludes("leftContent: false");
expectNotIncludes("rightContent?: boolean;");
expectNotIncludes("rightContent: false");
expectNotIncludes("sideGuard?: boolean;");
expectNotIncludes("sideGuard: true");
expectIncludes("const useCapsuleRight = computed(() => isMiniProgram.value && props.capsuleGuard);");
expectIncludes('"--navbar-capsule-width": `${navCapsuleWidth.value}px`');
expectIncludes("'navbar__side--capsule': useCapsuleRight");
expectIncludes("'navbar__side--hidden': !showLeft");
expectNotIncludes("!leftContent");
expectNotIncludes("!rightContent");
expectNotIncludes("navbar__side--unguarded");
expectNotIncludes('name="center"');
expectNotIncludes('name="left"');
expectIncludes('<slot v-if="customCenter" />');
expectIncludes('<text v-else-if="title" class="navbar__title">{{ title }}</text>');
expectSelectorIncludes(".navbar__side", ["flex: 0 0 var(--navbar-side-width);"]);
expectSelectorIncludes(".navbar__side--right", ["justify-content: flex-end;"]);
expectSelectorIncludes(".navbar__center", ["justify-content: center;"]);
expectSelectorIncludes(".navbar__side--capsule", [
  "flex-basis: var(--navbar-capsule-width);",
  "width: var(--navbar-capsule-width);",
  "min-width: var(--navbar-capsule-width);"
]);
expectSelectorIncludes(".navbar__side--hidden", [
  "flex-basis: 0;",
  "width: 0;",
  "min-width: 0;",
  "overflow: hidden;"
]);
