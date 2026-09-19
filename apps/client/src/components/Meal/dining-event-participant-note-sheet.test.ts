import assert from "node:assert/strict";
import test from "node:test";
import { appendTasteTag, buildTasteQuickGroups } from "./dining-event-participant-note";

test("口味档案只把四类数组生成标签，不拆分个人备注", () => {
  const groups = buildTasteQuickGroups({
    allergies: ["花生"],
    strictDislikes: ["酒精"],
    dislikedIngredients: ["香菜"],
    flavorPreferences: ["少辣"],
    note: "少油；清淡"
  });

  assert.deepEqual(groups.map(group => group.title), ["过敏", "严格忌口", "不喜欢食材", "口味偏好"]);
});

test("点击口味标签回填备注时去重并使用中文分号", () => {
  assert.equal(appendTasteTag("花生过敏；少辣", "少辣"), "花生过敏；少辣");
  assert.equal(appendTasteTag("花生过敏", "少辣"), "花生过敏；少辣");
  assert.equal(appendTasteTag("", "少辣"), "少辣");
});
