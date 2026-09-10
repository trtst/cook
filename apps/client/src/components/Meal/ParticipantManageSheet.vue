<template>
  <SheetShell
    :visible="visible"
    title="参与人管理"
    subtitle="这里会收口当前参与、待确认和已婉拒的邀请。"
    @close="emit('close')"
  >
    <view class="participant-sheet">
      <view class="participant-sheet__section">
        <text class="participant-sheet__title">当前参与</text>
        <view class="participant-sheet__list">
          <view
            v-for="item in currentItems"
            :key="item.key"
            class="participant-sheet__row"
            :class="{ 'participant-sheet__row--dimmed': item.dimmed }"
          >
            <view class="participant-sheet__avatar">
              <image v-if="item.avatarUrl" class="participant-sheet__avatar-image" :src="item.avatarUrl" mode="aspectFill" />
              <text v-else class="participant-sheet__avatar-fallback">{{ buildAvatarFallback(item.name) }}</text>
            </view>
            <view class="participant-sheet__main">
              <text class="participant-sheet__name">{{ item.name }}</text>
              <text class="participant-sheet__meta">{{ item.statusText }}</text>
            </view>
          </view>
        </view>

        <view class="participant-note">
          <view class="participant-note__head">
            <text class="participant-note__title">备注</text>
            <view
              v-if="canEditNote"
              class="participant-note__action"
              @click="emit('editNote')"
            >
              <text class="cookfont icon-edit participant-note__action-icon" />
              <text>{{ noteActionText }}</text>
            </view>
          </view>

          <view v-if="noteText" class="participant-note__card">
            <text class="participant-note__text">{{ noteText }}</text>
          </view>

          <view v-else class="participant-note__empty">
            <text class="participant-note__empty-title">{{ noteEmptyTitle }}</text>
            <text class="participant-note__empty-text">{{ noteEmptyText }}</text>
          </view>
        </view>
      </view>

      <view v-if="pendingItems.length" class="participant-sheet__section">
        <text class="participant-sheet__title">待确认</text>
        <view class="participant-sheet__list">
          <view
            v-for="item in pendingItems"
            :key="item.key"
            class="participant-sheet__row"
            :class="{ 'participant-sheet__row--dimmed': item.dimmed }"
          >
            <view class="participant-sheet__avatar">
              <image v-if="item.avatarUrl" class="participant-sheet__avatar-image" :src="item.avatarUrl" mode="aspectFill" />
              <text v-else class="participant-sheet__avatar-fallback">{{ buildAvatarFallback(item.name) }}</text>
            </view>
            <view class="participant-sheet__main">
              <text class="participant-sheet__name">{{ item.name }}</text>
              <text class="participant-sheet__meta">{{ item.statusText }}</text>
            </view>
            <button
              class="participant-sheet__action"
              :class="{ 'participant-sheet__action--disabled': submitting || actionParticipantId === item.participantId }"
              @click="handleRevoke(item)"
            >
              {{ actionParticipantId === item.participantId ? "处理中..." : "撤回" }}
            </button>
          </view>
        </view>
      </view>

      <view v-if="declinedItems.length" class="participant-sheet__section">
        <text class="participant-sheet__title">已婉拒</text>
        <view class="participant-sheet__list">
          <view
            v-for="item in declinedItems"
            :key="item.key"
            class="participant-sheet__row"
          >
            <view class="participant-sheet__avatar">
              <image v-if="item.avatarUrl" class="participant-sheet__avatar-image" :src="item.avatarUrl" mode="aspectFill" />
              <text v-else class="participant-sheet__avatar-fallback">{{ buildAvatarFallback(item.name) }}</text>
            </view>
            <view class="participant-sheet__main">
              <text class="participant-sheet__name">{{ item.name }}</text>
              <text class="participant-sheet__meta">{{ item.statusText }}</text>
            </view>
            <button
              class="participant-sheet__action participant-sheet__action--primary"
              :class="{ 'participant-sheet__action--disabled': submitting || actionParticipantId === item.participantId }"
              @click="handleReinvite(item)"
            >
              {{ actionParticipantId === item.participantId ? "处理中..." : "再邀" }}
            </button>
          </view>
        </view>
      </view>

      <view v-if="canInvite" class="participant-sheet__section">
        <text class="participant-sheet__title">邀请入口</text>
        <button
          class="participant-sheet__invite"
          :class="{ 'participant-sheet__invite--disabled': inviteSharing }"
          :open-type="inviteReady && !inviteSharing ? 'share' : ''"
          @click="handleInvite"
        >
          <text class="cookfont icon-share participant-sheet__invite-icon" />
          <text class="participant-sheet__invite-text">{{ inviteSharing ? "准备分享中" : inviteReady ? "分享邀请" : "准备分享邀请" }}</text>
        </button>
      </view>
    </view>
  </SheetShell>
</template>

<script setup lang="ts">
import type { UUID } from "@/apis/http";
import SheetShell from "@/components/Sheet/SheetShell.vue";

type ParticipantManageItem = {
  key: string;
  participantId: UUID | null;
  name: string;
  statusText: string;
  avatarUrl: string | null;
  dimmed: boolean;
  canRevoke: boolean;
  canReinvite: boolean;
};

const props = defineProps<{
  visible: boolean;
  currentItems: ParticipantManageItem[];
  pendingItems: ParticipantManageItem[];
  declinedItems: ParticipantManageItem[];
  canEditNote: boolean;
  noteActionText: string;
  noteText: string;
  noteEmptyTitle: string;
  noteEmptyText: string;
  canInvite: boolean;
  inviteReady: boolean;
  inviteSharing: boolean;
  submitting: boolean;
  actionParticipantId: UUID | null;
}>();

const emit = defineEmits<{
  close: [];
  editNote: [];
  invite: [];
  revoke: [item: ParticipantManageItem];
  reinvite: [item: ParticipantManageItem];
}>();

function buildAvatarFallback(name: string) {
  const text = name.trim();
  return (text[0] || "?").toUpperCase();
}

function isParticipantActionDisabled(item: ParticipantManageItem) {
  return props.submitting || props.actionParticipantId === item.participantId;
}

function handleRevoke(item: ParticipantManageItem) {
  if (isParticipantActionDisabled(item)) return;
  emit("revoke", item);
}

function handleReinvite(item: ParticipantManageItem) {
  if (isParticipantActionDisabled(item)) return;
  emit("reinvite", item);
}

function handleInvite() {
  if (props.inviteSharing) return;
  emit("invite");
}
</script>

<style scoped lang="scss">
.participant-sheet {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.participant-sheet__section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.participant-sheet__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 700;
}

.participant-sheet__list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.participant-sheet__row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 20rpx 22rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted-frost);
}

.participant-sheet__row--dimmed {
  opacity: 0.56;
}

.participant-sheet__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  overflow: hidden;
  border-radius: 50%;
  background: var(--color-tag-primary-bg);
}

.participant-sheet__avatar-image {
  display: block;
  width: 100%;
  height: 100%;
}

.participant-sheet__avatar-fallback {
  color: var(--color-tag-primary-text);
  font-size: 24rpx;
  font-weight: 700;
}

.participant-sheet__main {
  min-width: 0;
  flex: 1;
}

.participant-sheet__name,
.participant-sheet__meta {
  display: block;
}

.participant-sheet__name {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 600;
}

.participant-sheet__meta {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.5;
}

.participant-sheet__action {
  flex: 0 0 auto;
  min-width: 112rpx;
  min-height: 64rpx;
  padding: 0 22rpx;
  margin: 0;
  border: 0;
  border-radius: 999rpx;
  background: var(--color-surface-soft);
  color: var(--color-text-secondary);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1;
}

.participant-sheet__action::after {
  border: 0;
}

.participant-sheet__action--primary {
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
  color: var(--color-tag-primary-text);
}

.participant-sheet__action--disabled {
  opacity: 0.46;
}

.participant-sheet__invite {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  min-height: 92rpx;
  padding: 0 24rpx;
  border: 2rpx dashed var(--color-border-active);
  border-radius: var(--radius-xs);
  background: var(--color-surface-primary-panel-soft);
  box-sizing: border-box;
}

.participant-sheet__invite--disabled {
  opacity: 0.42;
}

.participant-sheet__invite::after {
  border: 0;
}

.participant-sheet__invite-icon {
  font-size: 24rpx;
}

.participant-sheet__invite-text {
  color: var(--color-support-action);
  font-size: 26rpx;
  font-weight: 600;
}

.participant-note {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.participant-note__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.participant-note__title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: 700;
}

.participant-note__action {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  color: var(--color-support-action);
  font-size: 24rpx;
  font-weight: 600;
}

.participant-note__action-icon {
  font-size: 22rpx;
  line-height: 1;
}

.participant-note__card {
  padding: 24rpx 28rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
}

.participant-note__text {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.7;
  white-space: pre-wrap;
}

.participant-note__empty {
  padding: 28rpx 26rpx;
  border-radius: var(--radius-xs);
  background: var(--color-support-notice);
}

.participant-note__empty-title,
.participant-note__empty-text {
  display: block;
}

.participant-note__empty-title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.participant-note__empty-text {
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}
</style>
