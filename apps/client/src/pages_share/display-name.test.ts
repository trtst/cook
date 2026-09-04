import assert from "node:assert/strict";
import { resolveShareGuestName } from "./display-name";

assert.equal(
  resolveShareGuestName(
    {
      uid: 104,
      nickname: " 下一餐主理人 ",
      avatarUrl: null,
      phone: "138xxxxx104"
    },
    104
  ),
  "下一餐主理人"
);

assert.equal(resolveShareGuestName(null, 2048), "用户 2048");
assert.equal(resolveShareGuestName(null, 0), "你");

console.log("share display-name tests passed");
