const { readFileSync } = require("fs");
const { resolve } = require("path");
const nodeAssert = require("assert").strict;
const nodeTest = require("node:test");

const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");

nodeTest("采购详情页不暴露完成采购后的入库主动作", () => {
  nodeAssert.doesNotMatch(pageSource, /primaryCardButtonText/);
  nodeAssert.doesNotMatch(pageSource, /handlePrimaryAction|finishList/);
  nodeAssert.doesNotMatch(pageSource, /entries: \[\]/);
  nodeAssert.doesNotMatch(pageSource, /自动记入冰箱|食材已记入冰箱/);
  nodeAssert.doesNotMatch(pageSource, /buildShoppingCompletePagePath/);
});

nodeTest("采购详情页只保留逐项已购状态", () => {
  nodeAssert.match(pageSource, /class="purchase-check"/);
  nodeAssert.match(pageSource, /isItemChecked\(group\)/);
  nodeAssert.doesNotMatch(pageSource, /数量和到期时间可以之后再补充/);
});

nodeTest("添加食材只选择食材并以按需购买加入清单", () => {
  nodeAssert.match(pageSource, /支持多选/);
  nodeAssert.match(pageSource, /selectedIngredients\.length/);
  nodeAssert.match(pageSource, /添加 \$\{selectedIngredients\.length\} 项/);
  nodeAssert.match(pageSource, /按需购买/);
  nodeAssert.doesNotMatch(pageSource, /再补数量和备注/);
  nodeAssert.doesNotMatch(pageSource, /addQuantityText/);
  nodeAssert.doesNotMatch(pageSource, /addNote/);
  nodeAssert.doesNotMatch(pageSource, /当前搜索词作为手动项/);
});

nodeTest("清单标题仅允许清单创建者在进行中状态修改", () => {
  nodeAssert.match(pageSource, /v-if="canRename"[\s\S]*?icon-edit detail-hero__edit/);
  nodeAssert.match(pageSource, /const canRename = computed\(\(\) => detail\.value\?\.role === "OWNER" && detail\.value\.status === "ACTIVE"\)/);
  nodeAssert.match(pageSource, /title="修改清单名"/);
  nodeAssert.match(pageSource, /shoppingApi\.renameList\(current\.id/);
  nodeAssert.match(pageSource, /version: current\.version/);
});

nodeTest("清单作废仍从导航栏设置打开", () => {
  nodeAssert.match(pageSource, /#navbar-center[\s\S]*?detail-nav-settings/);
  nodeAssert.match(pageSource, /:navbar-capsule-guard="true"/);
  nodeAssert.match(pageSource, /openSettingsSheet/);
  nodeAssert.match(pageSource, /title="清单设置"/);
  nodeAssert.match(pageSource, /作废清单/);
});

nodeTest("添加食材固定显示在页面底部，清单项使用自定义勾选框", () => {
  nodeAssert.match(pageSource, /class="detail-footer"/);
  nodeAssert.match(pageSource, /<MealFooterActions[\s\S]*?:quick-action="\{ label: '添加食材', iconClass: 'icon-add' \}"/);
  nodeAssert.match(pageSource, /@quick="openAddSheet"/);
  nodeAssert.match(pageSource, /class="purchase-check"/);
  nodeAssert.match(pageSource, /purchase-check--checked/);
  nodeAssert.doesNotMatch(pageSource, /<ImageLoader class="item-row__image"/);
  nodeAssert.doesNotMatch(pageSource, /class="mini-pill[\s\S]*?已购/);
  nodeAssert.match(pageSource, /class="item-origin-list"/);
});

nodeTest("食材分类随名称排列，状态与来源位于右侧，来源箭头随展开翻转", () => {
  nodeAssert.match(pageSource, /class="item-row__identity"[\s\S]*?class="item-row__title"[\s\S]*?class="item-row__category"/);
  nodeAssert.match(pageSource, /class="item-row__left"[\s\S]*?class="item-row__identity"[\s\S]*?class="item-row__quantity"/);
  nodeAssert.match(pageSource, /class="item-row__right"[\s\S]*?class="item-row__fridge-hint"[\s\S]*?class="item-row__origin-toggle"/);
  nodeAssert.match(pageSource, /\.item-row__quantity\s*\{[^}]*text-align:\s*left/);
  nodeAssert.match(pageSource, /item-row__origin-arrow--open/);
  nodeAssert.match(pageSource, /\.item-row__origin-arrow--open\s*\{[^}]*transform:\s*rotate\(-90deg\)/);
});
