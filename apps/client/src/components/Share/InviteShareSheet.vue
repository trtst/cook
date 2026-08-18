<template>
  <SheetShell
    :visible="visible"
    :title="title"
    :subtitle="subtitle"
    @close="emit('close')"
    @after-close="emit('afterClose')"
  >
    <template v-if="$slots['title-extra']" #title-extra>
      <slot name="title-extra" />
    </template>

    <slot name="header" />

    <view class="invite-share__actions" :class="{ 'invite-share__actions--single': singleShare }">
      <button
        v-if="!singleShare && memberAction"
        class="invite-share__action-card"
        :class="{ 'invite-share__action-card--disabled': memberAction.disabled || memberAction.muted }"
        :disabled="memberAction.disabled"
        :open-type="memberAction.openType || ''"
        @click="emit('member')"
      >
        <view class="invite-share__tag">
          <text class="cookfont invite-share__tag-icon">&#xe6c8;</text>
        </view>
        <text class="invite-share__action-title">{{ memberAction.label }}</text>
        <text class="invite-share__action-hint">{{ memberAction.hint }}</text>
      </button>

      <button
        class="invite-share__action-card"
        :class="{ 'invite-share__action-card--disabled': friendAction.disabled || friendAction.muted }"
        :disabled="friendAction.disabled"
        :open-type="friendAction.openType || ''"
        @click="emit('friend')"
      >
        <view class="invite-share__tag">
          <text class="cookfont invite-share__tag-icon">&#xe6c8;</text>
        </view>
        <text class="invite-share__action-title">{{ friendAction.label }}</text>
        <text class="invite-share__action-hint">{{ friendAction.hint }}</text>
      </button>
    </view>

    <view v-if="errorText" class="sheet-note sheet-note--error">{{ errorText }}</view>
    <text v-if="hintText" class="invite-share__hint">{{ hintText }}</text>
    <view v-if="showCloseAction" class="invite-share__close-action">
      <button class="action-pill action-pill--danger" :disabled="closeActionDisabled" @click="emit('closeAction')">{{ closeActionText }}</button>
    </view>

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
    <template v-else-if="showDefaultFooter" #footer>
      <view class="invite-share__footer">
        <button class="invite-share__footer-button invite-share__footer-button--cancel" @click="emit('close')">{{ closeText }}</button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import SheetShell from "@/components/Sheet/SheetShell.vue";

type InviteShareAction = {
  label: string;
  hint: string;
  disabled?: boolean;
  muted?: boolean;
  openType?: string;
};

withDefaults(defineProps<{
  visible: boolean;
  title: string;
  subtitle?: string;
  singleShare?: boolean;
  memberAction?: InviteShareAction | null;
  friendAction: InviteShareAction;
  hintText?: string;
  errorText?: string;
  showCloseAction?: boolean;
  closeActionText?: string;
  closeActionDisabled?: boolean;
  showDefaultFooter?: boolean;
  closeText?: string;
}>(), {
  subtitle: "",
  singleShare: false,
  memberAction: null,
  hintText: "",
  errorText: "",
  showCloseAction: false,
  closeActionText: "关闭分享",
  closeActionDisabled: false,
  showDefaultFooter: false,
  closeText: "关闭"
});

const emit = defineEmits<{
  (event: "close"): void;
  (event: "afterClose"): void;
  (event: "member"): void;
  (event: "friend"): void;
  (event: "closeAction"): void;
}>();
</script>

<style scoped>
.invite-share__actions {
  display: grid;
  gap: 20rpx;
}

.invite-share__actions--single {
  grid-template-columns: minmax(0, 1fr);
}

.invite-share__action-card {
  position: relative;
  display: block;
  width: 100%;
  margin: 0;
  padding: 24rpx;
  border: 0;
  border-radius: 28rpx;
  background: var(--color-surface);
  box-sizing: border-box;
  line-height: 1.5;
  text-align: left;
}

.invite-share__action-card::after {
  border: 0;
}

.invite-share__action-card--disabled {
  opacity: 0.58;
}

.invite-share__tag {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
}

.invite-share__tag-icon {
  color: #7c5600;
  font-size: 28rpx;
}

.invite-share__action-title,
.invite-share__action-hint,
.invite-share__hint {
  display: block;
}

.invite-share__action-title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.invite-share__action-hint {
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.invite-share__hint {
  margin-top: 20rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.invite-share__close-action {
  margin-top: 20rpx;
}

.invite-share__footer {
  display: flex;
  gap: 18rpx;
}

.invite-share__footer-button {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 86rpx;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  text-align: center;
}

.invite-share__footer-button::after {
  border: 0;
}

.invite-share__footer-button--cancel {
  background: rgba(255, 255, 255, 0.82);
  color: var(--color-text-secondary);
}
</style>
