import {
  ElAlert,
  ElAside,
  ElButton,
  ElCard,
  ElCheckbox,
  ElContainer,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDrawer,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElHeader,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElLoading,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElOption,
  ElOptionGroup,
  ElPagination,
  ElRadio,
  ElRadioGroup,
  ElResult,
  ElSelect,
  ElSkeleton,
  ElSlider,
  ElSubMenu,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTag,
  ElText
} from "element-plus";
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";

import "element-plus/dist/index.css";
import "./styles/global.scss";

const app = createApp(App);
const components = [
  ElAlert,
  ElAside,
  ElButton,
  ElCard,
  ElCheckbox,
  ElContainer,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDrawer,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElHeader,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElOption,
  ElOptionGroup,
  ElPagination,
  ElRadio,
  ElRadioGroup,
  ElResult,
  ElSelect,
  ElSkeleton,
  ElSlider,
  ElSubMenu,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTag,
  ElText
] as const;

app.use(createPinia());
app.use(router);
app.directive("loading", ElLoading.directive);

for (const component of components) {
  if (!component.name) continue;
  app.component(component.name, component);
}

app.mount("#app");
