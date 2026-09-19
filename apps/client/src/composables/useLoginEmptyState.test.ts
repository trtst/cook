import assert from "node:assert/strict";
import test from "node:test";
import { createLoginEmptyStateController } from "./useLoginEmptyState";

const session = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  accessExpiresAt: "2099-01-01T00:00:00.000Z",
  refreshExpiresAt: "2099-02-01T00:00:00.000Z",
  user: {
    uid: 7,
    nickname: "测试用户",
    avatarUrl: null,
    phone: "13800000000"
  }
};

test("login empty controller opens with its source and ignores other login results", async () => {
  const openedSourceIds: string[] = [];
  const receivedSessions: unknown[] = [];
  const controller = createLoginEmptyStateController(
    sourceId => {
      openedSourceIds.push(sourceId);
    },
    payload => {
      receivedSessions.push(payload.session);
    },
    "page-source"
  );

  controller.openLogin();
  await controller.handleLoginSuccess({ sourceId: "other-page", session });
  await controller.handleLoginSuccess({ sourceId: "page-source", session });

  assert.deepEqual(openedSourceIds, ["page-source"]);
  assert.deepEqual(receivedSessions, [session]);
});
