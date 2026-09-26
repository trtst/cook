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

nodeTest("清单设置从导航栏打开，且不再提供改名入口", () => {
  nodeAssert.match(pageSource, /#navbar-right/);
  nodeAssert.match(pageSource, /openSettingsSheet/);
  nodeAssert.match(pageSource, /title="清单设置"/);
  nodeAssert.match(pageSource, /作废清单/);
  nodeAssert.doesNotMatch(pageSource, /renameSheetVisible|renameList|openRenameSheet|修改清单名/);
});

nodeTest("添加食材固定显示在页面底部，清单项使用自定义勾选框", () => {
  nodeAssert.match(pageSource, /class="detail-footer"/);
  nodeAssert.match(pageSource, /class="detail-footer__add"/);
  nodeAssert.match(pageSource, /class="purchase-check"/);
  nodeAssert.match(pageSource, /purchase-check--checked/);
  nodeAssert.doesNotMatch(pageSource, /<ImageLoader class="item-row__image"/);
  nodeAssert.doesNotMatch(pageSource, /class="mini-pill[\s\S]*?已购/);
  nodeAssert.match(pageSource, /查看来源/);
});

nodeTest("食材分类随名称排列，状态与来源位于右侧，来源箭头随展开翻转", () => {
  nodeAssert.match(pageSource, /class="item-row__identity"[\s\S]*?class="item-row__title"[\s\S]*?class="item-row__category"/);
  nodeAssert.match(pageSource, /class="item-row__top"[\s\S]*?class="item-row__identity"[\s\S]*?class="item-row__fridge-hint"/);
  nodeAssert.match(pageSource, /class="item-row__bottom"[\s\S]*?class="item-row__quantity"[\s\S]*?class="item-row__origin-toggle"/);
  nodeAssert.match(pageSource, /\.item-row__quantity\s*\{[^}]*text-align:\s*left/);
  nodeAssert.match(pageSource, /item-row__origin-arrow--open/);
  nodeAssert.match(pageSource, /\.item-row__origin-arrow--open\s*\{[^}]*transform:\s*rotate\(180deg\)/);
});
