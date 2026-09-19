<template>
  <SheetShell
    :visible="visible"
    title="我的备注"
    subtitle="把这次饭局需要注意的饮食习惯告诉大家。"
    :body-scroll="false"
    @close="emit('close')"
    @after-close="emit('afterClose')"
  >
    <view class="participant-note-sheet">
      <textarea
        v-model="model"
        class="participant-note-sheet__input"
        maxlength="255"
        placeholder="例如：花生过敏；这次少辣"
        placeholder-class="participant-note-sheet__placeholder"
      />

      <view class="participant-note-sheet__quick-head">
        <text class="participant-note-sheet__quick-title">从我的口味快速添加</text>
        <text class="participant-note-sheet__quick-meta">点击标签即可填入备注</text>
      </view>

      <scroll-view scroll-y class="participant-note-sheet__quick-scroll" :show-scrollbar="false">
        <view v-if="tasteLoading" class="participant-note-sheet__state">正在读取我的口味...</view>
        <view v-else-if="tasteError" class="participant-note-sheet__state participant-note-sheet__state--error" @click="emit('retryTaste')">
          {{ tasteError }}，点击重试
        </view>
        <view v-else-if="!groups.some(group => group.items.length)" class="participant-note-sheet__state">
          还没有记录口味，可以直接填写备注。
        </view>
        <view v-else class="participant-note-sheet__groups">
          <view v-for="group in groups" v-show="group.items.length" :key="group.key" class="participant-note-sheet__group">
            <text class="participant-note-sheet__group-title">{{ group.title }}</text>
            <view class="participant-note-sheet__tags">
              <view
                v-for="item in group.items"
                :key="item.key"
                class="participant-note-sheet__tag"
                :class="{ 'participant-note-sheet__tag--selected': isSelected(item.label) }"
                @click="toggleItem(item.label)"
              >
                <text class="participant-note-sheet__tag-mark">{{ isSelected(item.label) ? "✓" : "+" }}</text>
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <template #footer>
      <view class="participant-note-sheet__actions">
        <button
          class="participant-note-sheet__button participant-note-sheet__button--cancel"
          :class="{ 'participant-note-sheet__button--disabled': submitting }"
          @click="handleClose"
        >取消</button>
        <button
          class="participant-note-sheet__button participant-note-sheet__button--confirm"
          :class="{ 'participant-note-sheet__button--disabled': submitting }"
          @click="handleConfirm"
        >{{ submitting ? "保存中..." : "保存备注" }}</button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { appendTasteTag, type TasteQuickGroup } from "./dining-event-participant-note";

const props = withDefaults(defineProps<{
  visible: boolean;
  modelValue: string;
  groups: TasteQuickGroup[];
  tasteLoading: boolean;
  tasteError: string;
  submitting: boolean;
}>(), {
  tasteError: ""
});

const emit = defineEmits<{
  close: [];
  afterClose: [];
  confirm: [];
  retryTaste: [];
  "update:modelValue": [value: string];
}>();

const model = computed({
  get: () => props.modelValue,
  set: value => emit("update:modelValue", value)
});

function readItems() {
  return model.value.split(/[;；]/).map(item => item.trim()).filter(Boolean);
}

function isSelected(label: string) {
  return readItems().includes(label);
}

function toggleItem(label: string) {
  if (props.submitting) return;
  if (isSelected(label)) {
    emit("update:modelValue", readItems().filter(item => item !== label).join("；"));
    return;
  }
  emit("update:modelValue", appendTasteTag(model.value, label));
}

function handleClose() {
  if (!props.submitting) emit("close");
}

function handleConfirm() {
  if (!props.submitting) emit("confirm");
}
</script>

<style scoped lang="scss">
.participant-note-sheet {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  gap: 22rpx;
}

.participant-note-sheet__input {
  flex: 0 0 auto;
  display: block;
  width: 100%;
  min-height: 190rpx;
  height: 190rpx;
  padding: 24rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-xs);
  background: var(--material-input-bg);
  box-shadow: var(--material-input-shadow);
  box-sizing: border-box;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.7;
}

.participant-note-sheet__placeholder {
  color: var(--color-text-tertiary);
}

.participant-note-sheet__quick-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 18rpx;
}

.participant-note-sheet__quick-title,
.participant-note-sheet__group-title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 700;
}

.participant-note-sheet__quick-meta {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
}

.participant-note-sheet__quick-scroll {
  flex: 1;
  min-height: 0;
}

.participant-note-sheet__groups {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding-bottom: 10rpx;
}

.participant-note-sheet__group {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.participant-note-sheet__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.participant-note-sheet__tag {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  min-height: 58rpx;
  padding: 0 18rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted-frost);
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.participant-note-sheet__tag--selected {
  border-color: var(--color-primary);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
}

.participant-note-sheet__tag-mark {
  font-weight: 700;
}

.participant-note-sheet__state {
  padding: 28rpx 0;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
  text-align: center;
}

.participant-note-sheet__state--error {
  color: var(--color-danger);
}

.participant-note-sheet__actions {
  display: flex;
  gap: 18rpx;
}

.participant-note-sheet__button {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  height: 90rpx;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.participant-note-sheet__button::after {
  border: 0;
}

.participant-note-sheet__button--cancel {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
}

.participant-note-sheet__button--confirm {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.participant-note-sheet__button--disabled {
  opacity: 0.46;
}
</style>
