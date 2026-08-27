# Guest Entry Login Empty State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let most `我的` page entries open their landing pages while logged out, and replace page-embedded `Login` blocks with tappable guest empty states that open `LoginModal`.

**Architecture:** Keep the login capability unchanged and only move the trigger point. Add one tiny client-side replacement component that preserves the current login-success event contract, then switch affected pages from inline `Login` rendering to the new empty-state trigger. Narrow `我的` page entry interception to an explicit whitelist.

**Tech Stack:** uni-app, Vue 3 `script setup`, TypeScript, Pinia, existing `LoginModal` and `Empty` components

---

### Task 1: Add a reusable guest empty login trigger

**Files:**
- Create: `apps/client/src/components/Login/LoginEmptyState.vue`

- [ ] **Step 1: Create the replacement component**

```vue
<template>
  <Empty
    class="login-empty"
    :title="title"
    :description="description"
    :art="art"
    :plain="plain"
    clickable
    @click="openLogin"
  />
</template>
```

- [ ] **Step 2: Preserve the existing login-success event contract**

```ts
const emit = defineEmits<{
  success: [payload: LoginSuccessPayload];
}>();
```

- [ ] **Step 3: Keep the modal trigger source tracking**

```ts
const sourceId = createOperationId();
const stopListening = onLoginSuccess((payload) => {
  if (payload.sourceId !== sourceId) return;
  emit("success", { session: payload.session });
});
```

### Task 2: Narrow `我的` page entry interception

**Files:**
- Modify: `apps/client/src/pages/me/index.vue`
- Test: `apps/client/src/pages/me/index.test.js`

- [ ] **Step 1: Change entry semantics to explicit whitelist**

```ts
interface PageEntry {
  requiresLogin?: boolean;
}
```

- [ ] **Step 2: Mark only notification, taste, and account as entry-level login targets**

```ts
const notificationEntry = {
  requiresLogin: true
};
```

- [ ] **Step 3: Let medal open its landing page directly**

```ts
function handleMedalClick() {
  navigateTo("/pages_me/medal/index");
}
```

- [ ] **Step 4: Add a regression test for the whitelist behavior**

```js
expect(await page.callMethod("automatorResolveEntryAuth", "通知中心")).toEqual({ requiresLogin: true });
expect(await page.callMethod("automatorResolveEntryAuth", "计划")).toEqual({ requiresLogin: false });
expect(await page.callMethod("automatorResolveEntryAuth", "我的勋章")).toEqual({ requiresLogin: false });
```

### Task 3: Replace page-level `Login` blocks with guest empty states

**Files:**
- Modify: `apps/client/src/pages_meal/random/index.vue`
- Modify: `apps/client/src/pages_meal/event/index.vue`
- Modify: `apps/client/src/pages_meal/plan/index.vue`
- Modify: `apps/client/src/pages_pantry/index/index.vue`
- Modify: `apps/client/src/pages_pantry/list/index.vue`
- Modify: `apps/client/src/pages_pantry/history/index.vue`
- Modify: `apps/client/src/pages_pantry/gap/index.vue`
- Modify: `apps/client/src/pages_pantry/supermarket/index.vue`
- Modify: `apps/client/src/pages_pantry/item-detail/index.vue`
- Modify: `apps/client/src/pages_pantry/item-edit/index.vue`
- Modify: `apps/client/src/pages_pantry/list-detail/index.vue`
- Modify: `apps/client/src/pages_me/medal/index.vue`
- Modify: `apps/client/src/pages_me/medal-detail/index.vue`
- Modify: `apps/client/src/pages_me/account/index.vue`

- [ ] **Step 1: Swap imports from `Login` to `LoginEmptyState`**

```ts
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
```

- [ ] **Step 2: Replace the template block**

```vue
<LoginEmptyState
  v-if="!sessionStore.isLoggedIn"
  title="登录后查看采购清单"
  description="共享清单、协作采购和分享加入都需要登录后处理。"
  :art="emptyStateArt"
  @success="handleLoginSuccess"
/>
```

- [ ] **Step 3: Keep existing page refresh handlers where already present**

```vue
@success="handleLoginSuccess"
```

### Task 4: Record and verify

**Files:**
- Modify: `docs/plans/minor_change_log.md`

- [ ] **Step 1: Append a concise central log entry**

```md
| 2026-08-26 | 收口未登录入口与空状态登录触发... | ... | ... |
```

- [ ] **Step 2: Run the smallest relevant checks**

```bash
pnpm --filter @next-meal/client test -- --runInBand apps/client/src/pages/me/index.test.js
pnpm --filter @next-meal/client type-check
git diff --check -- apps/client/src/components/Login/LoginEmptyState.vue apps/client/src/pages/me/index.vue docs/plans/minor_change_log.md
```
