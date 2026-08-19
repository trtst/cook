<script setup lang="ts">
import "quill/dist/quill.snow.css";

import { onBeforeUnmount, onMounted, ref, watch } from "vue";

type UploadImageHandler = (file: File) => Promise<string>;

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    disabled?: boolean;
    uploadImage?: UploadImageHandler;
  }>(),
  {
    placeholder: "请输入正文内容",
    disabled: false,
    uploadImage: undefined
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:text": [value: string];
}>();

const rootRef = ref<HTMLDivElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
let quill: {
  root: HTMLDivElement;
  clipboard: { dangerouslyPasteHTML: (html: string) => void };
  getText: () => string;
  getSelection: (focus?: boolean) => { index: number; length: number } | null;
  insertEmbed: (index: number, type: string, value: string, source?: string) => void;
  setSelection: (index: number, length?: number) => void;
  enable: (enabled?: boolean) => void;
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
} | null = null;
let detachHandler: (() => void) | null = null;
let syncing = false;

function emitChange() {
  if (!quill) return;
  emit("update:modelValue", quill.root.innerHTML);
  emit("update:text", quill.getText().trim());
}

async function handleImageChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  if (!file || !props.uploadImage || !quill) return;

  const url = await props.uploadImage(file);
  const range = quill.getSelection(true);
  const index = range?.index ?? quill.getText().length;
  quill.insertEmbed(index, "image", url, "user");
  quill.setSelection(index + 1, 0);
  if (input) input.value = "";
  emitChange();
}

onMounted(async () => {
  if (!rootRef.value) return;
  const { default: Quill } = await import("quill");
  const instance = new Quill(rootRef.value, {
    theme: "snow",
    placeholder: props.placeholder,
    readOnly: props.disabled,
    modules: {
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "blockquote"],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ align: [] }],
          ["link", "image"],
          ["clean"]
        ],
        handlers: {
          image: () => {
            fileInputRef.value?.click();
          }
        }
      }
    }
  });

  quill = instance as typeof quill;
  const currentQuill = quill;
  if (!currentQuill) return;

  if (props.modelValue) {
    syncing = true;
    currentQuill.clipboard.dangerouslyPasteHTML(props.modelValue);
    syncing = false;
  }

  const handler = () => {
    if (syncing) return;
    emitChange();
  };
  currentQuill.on("text-change", handler);
  detachHandler = () => {
    currentQuill.off("text-change", handler);
  };
});

watch(
  () => props.modelValue,
  value => {
    const currentQuill = quill;
    if (!currentQuill) return;
    const current = currentQuill.root.innerHTML;
    if (value === current) return;
    syncing = true;
    currentQuill.clipboard.dangerouslyPasteHTML(value || "");
    syncing = false;
  }
);

watch(
  () => props.disabled,
  value => {
    const currentQuill = quill;
    if (!currentQuill) return;
    currentQuill.enable(!value);
  }
);

onBeforeUnmount(() => {
  detachHandler?.();
  detachHandler = null;
  quill = null;
});
</script>

<template>
  <div class="rich-editor">
    <div ref="rootRef" class="rich-editor__root" />
    <input ref="fileInputRef" class="rich-editor__input" type="file" accept="image/png,image/jpeg,image/webp" @change="handleImageChange" />
  </div>
</template>

<style scoped lang="scss">
.rich-editor {
  border: 1px solid #dcdfe6;
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
}

.rich-editor__root :deep(.ql-toolbar.ql-snow) {
  border: 0;
  border-bottom: 1px solid #ebeef5;
  padding: 12px;
}

.rich-editor__root :deep(.ql-container.ql-snow) {
  border: 0;
  min-height: 360px;
  font-size: 15px;
  line-height: 1.7;
}

.rich-editor__root :deep(.ql-editor) {
  min-height: 360px;
}

.rich-editor__root :deep(.ql-editor p),
.rich-editor__root :deep(.ql-editor li) {
  line-height: 1.8;
}

.rich-editor__root :deep(.ql-editor img) {
  max-width: 100%;
  border-radius: 12px;
}

.rich-editor__input {
  display: none;
}
</style>
