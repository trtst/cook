import { computed, nextTick, ref, toValue, watch, type MaybeRefOrGetter, type WatchSource } from "vue";
import { uniPlatform } from "@/platform/uni";

interface FixedPanelLayoutOptions {
  panelId: string;
  topPx: MaybeRefOrGetter<number>;
  watchSources?: WatchSource<unknown> | WatchSource<unknown>[];
}

export function useFixedPanelLayout(options: FixedPanelLayoutOptions) {
  const panelHeight = ref(0);

  const panelStyle = computed(() => ({
    top: `${toValue(options.topPx)}px`
  }));

  const contentStyle = computed(() => {
    const offset = Math.max(panelHeight.value, 0);
    return {
      marginTop: `${offset}px`,
      height: offset ? `calc(100% - ${offset}px)` : "100%"
    };
  });

  async function measurePanel() {
    const panelRect = await uniPlatform.system.measure(`#${options.panelId}`);
    panelHeight.value = panelRect?.height || 0;
  }

  async function syncPanel() {
    await nextTick();
    await measurePanel();
  }

  if (options.watchSources) {
    watch(
      options.watchSources,
      () => {
        void syncPanel();
      },
      { immediate: true, flush: "post" }
    );
  }

  return {
    panelHeight,
    panelStyle,
    contentStyle,
    measurePanel,
    syncPanel
  };
}
