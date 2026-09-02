import assert from "node:assert/strict";
import { KNOWLEDGE_CHANNELS, buildKnowledgeListPath, getKnowledgeChannel } from "./knowledge-articles";

const entries = Object.entries(KNOWLEDGE_CHANNELS);

assert.deepEqual(
  entries.map(([code, item]) => [code, item.title, item.description]),
  [
    ["KITCHEN", "厨房百事", "用什么、怎么买、怎么存、怎么备"],
    ["COOK", "烹调技法", "怎么做、为什么这样做、失败怎么救"],
    ["FOOD", "饮食文化", "餐桌上的节气、地域、传统、人情"]
  ],
  "knowledge channels should use the settled three short codes"
);

assert.equal(getKnowledgeChannel("KITCHEN")?.title, "厨房百事", "KITCHEN should resolve to 厨房百事");
assert.equal(buildKnowledgeListPath("COOK"), "/pages_me/knowledge-list/index?channelCode=COOK", "list path should use the stable code");
