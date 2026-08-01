import { computed, ref } from "vue";

const DEFAULT_THRESHOLD = 88;
const DEFAULT_SUCCESS_DURATION = 500;

type RefresherText = {
	pulling?: string;
	canRelease?: string | string[];
	success?: string;
};

interface RefresherOptions {
	threshold?: number;
	successDuration?: number;
	text?: RefresherText;
}

const DEFAULT_TEXT: Required<RefresherText> = {
	pulling: "下拉刷新",
	canRelease: ["松手即可刷新"],
	success: "刷新成功"
};

function pickText(source: string | string[]) {
	if (Array.isArray(source)) {
		if (!source.length) return "";
		return source[Math.floor(Math.random() * source.length)] || "";
	}
	return source;
}

export function useCustomRefresher(options: RefresherOptions = {}) {
	const threshold = options.threshold ?? DEFAULT_THRESHOLD;
	const successDuration = options.successDuration ?? DEFAULT_SUCCESS_DURATION;
	const text = {
		...DEFAULT_TEXT,
		...(options.text ?? {})
	};

	const pullDistance = ref(0);
	const refreshing = ref(false);
	const showSuccess = ref(false);
	const reachedThreshold = ref(false);
	const currentReleaseText = ref("");

	function ensureReleaseText() {
		if (!currentReleaseText.value) {
			currentReleaseText.value = pickText(text.canRelease);
		}
		return currentReleaseText.value;
	}

	const status = computed(() => {
		if (showSuccess.value) return "success" as const;
		if (refreshing.value || pullDistance.value >= threshold) return "canRelease" as const;
		if (pullDistance.value > 0) return "pulling" as const;
		return "idle" as const;
	});

	const refresherText = computed(() => {
		if (status.value === "success") return text.success;
		if (status.value === "canRelease") {
			return ensureReleaseText();
		}
		return text.pulling;
	});

	const refresherTriggered = computed(() => refreshing.value || showSuccess.value);

	function resetPullState() {
		pullDistance.value = 0;
		reachedThreshold.value = false;
		currentReleaseText.value = "";
	}

	function onRefresherPulling(event: { detail?: { dy?: number; deltaY?: number } }) {
		const nextDistance = Math.max(0, event?.detail?.dy ?? event?.detail?.deltaY ?? 0);
		const crossedThreshold = pullDistance.value < threshold && nextDistance >= threshold;
		pullDistance.value = nextDistance;
		reachedThreshold.value = nextDistance >= threshold;
		if (crossedThreshold) {
			ensureReleaseText();
		}
	}

	function onRefresherRefresh() {
		if (!reachedThreshold.value || refreshing.value) return false;
		ensureReleaseText();
		refreshing.value = true;
		showSuccess.value = false;
		return true;
	}

	async function onRefreshComplete() {
		refreshing.value = false;
		showSuccess.value = true;
		setTimeout(() => {
			showSuccess.value = false;
			resetPullState();
		}, successDuration);
	}

	function onRefresherRestore() {
		if (refreshing.value || showSuccess.value) return;
		resetPullState();
	}

	return {
		threshold,
		pullDistance,
		refreshing,
		showSuccess,
		refresherText,
		refresherTriggered,
		onRefresherPulling,
		onRefresherRefresh,
		onRefreshComplete,
		onRefresherRestore
	};
}
