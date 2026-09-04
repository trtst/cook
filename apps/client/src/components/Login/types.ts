import type { AuthSessionResult } from "@/apis/auth";

export const loginCopyCandidates: readonly [string, string][] = [
	["饭点到了", "一起想想吃什么"],
	["厨房有光", "今天也好好吃饭"],
	["下一顿饭", "从这里慢慢决定"],
	["三餐有序", "日子自有烟火"],
	["晚风正好", "把想吃的先记下"],
	["冰箱有余", "餐桌就有答案"],
	["今天下厨", "先从一顿饭开始"],
	["家常不急", "慢慢配出好味道"],
	["一餐一记", "把日子过得有味"],
	["有人一起", "吃饭就更认真"],
	["锅里热着", "心里也安稳一点"],
	["菜谱在手", "今晚少纠结一点"],
	["饭菜上桌", "平常也值得期待"],
	["留一点香气", "给今天收个尾"]
];

export function pickLoginCopy(seed = Math.random()): { firstLine: string; secondLine: string } {
	const safeSeed = Number.isFinite(seed) ? Math.min(Math.max(seed, 0), 0.999999) : 0;
	const [firstLine, secondLine] = loginCopyCandidates[Math.floor(safeSeed * loginCopyCandidates.length)];
	return { firstLine, secondLine };
}

export interface LoginSuccessPayload {
  session: AuthSessionResult;
}
