import type { IngredientProteinType } from "../../contracts/types";

type IngredientFactInput = {
  name: string;
  categoryCode?: string | null;
  aliases?: string[];
};

type IngredientTagFacts = {
  proteinType: IngredientProteinType | null;
  isStaple: boolean;
  isSpicyIngredient: boolean;
  aliases: string[];
};

const ingredientAliasMap: Record<string, string[]> = {
  番茄: ["西红柿"],
  土豆: ["马铃薯"],
  里脊肉: ["猪里脊"],
  猪里脊: ["里脊肉"],
  北豆腐: ["老豆腐"],
  南豆腐: ["嫩豆腐"],
  内酯豆腐: ["嫩豆腐"],
  香菇: ["冬菇"],
  生抽: ["酱油"],
  老抽: ["酱油"]
};

function dedupeAliases(name: string, values: string[]) {
  const trimmedName = name.trim();
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of values) {
    const value = item.trim();
    if (!value || value === trimmedName || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function inferProteinType(name: string, categoryCode?: string | null): IngredientProteinType | null {
  if (/(鸡蛋|鸭蛋|鹅蛋|鹌鹑蛋|皮蛋|蛋清)/.test(name)) return "EGG";
  if (/(素鸡|素火腿|素虾|素肉|素肠|豆腐|豆干|豆皮|腐竹|千张|豆腐泡|豆腐乳)/.test(name)) return "PLANT";
  if (/(牛肉|牛腩|肥牛|牛排|牛里脊|牛肉丸|牛肉末|黄牛肉|瘦牛肉|牛杂)/.test(name)) return "BEEF";
  if (/(羊肉|羊排|羊蝎子)/.test(name)) return "LAMB";
  if (/(鸡肉|鸡腿|鸡翅|鸡胸|鸡爪|凤爪|鸡丁|鸡杂|三黄鸡|仔鸡|鸡骨|鸡$)/.test(name)) return "CHICKEN";
  if (/(鸭肉|鸭腿|鸭翅|鸭血|鸭子|腊鸭)/.test(name)) return "DUCK";
  if (/(猪肉|五花肉|排骨|猪里脊|里脊肉|猪蹄|猪肝|腊肠|肉末|肉沫|肉丝|肉片|肉丸|猪尾|猪骨|肥肠|梅花肉|猪肋排|腊肉|火腿|培根|香肠)/.test(name)) return "PORK";
  if (/(草鱼|鲤鱼|鲫鱼|带鱼|鲈鱼|三文鱼|鳕鱼|金枪鱼|罗非鱼|黄花鱼|黄鱼|秋刀鱼|鳗鱼|鳗鲡|鲳鱼|鲢鱼|鳊鱼|鳜鱼|鲶鱼|武昌鱼|巴沙鱼|多宝鱼|石斑鱼|鲅鱼|龙利鱼)/.test(name)) return "FISH";
  if (/(虾|蟹|贝|蛤|蚝|鲍鱼|鱿鱼|墨鱼|海鲜)/.test(name)) return "SEAFOOD";
  if (categoryCode === "SEAFOOD") return "SEAFOOD";
  return null;
}

function inferIsStaple(name: string, categoryCode?: string | null) {
  if (categoryCode === "GRAINS_STAPLES") return true;
  return /(米饭|大米|面粉|挂面|意面|河粉|米粉|米线|粉丝|粉条|年糕|燕麦|小米|糯米|玉米面|手抓饼|饺子|馄饨)/.test(
    name
  );
}

function inferIsSpicyIngredient(name: string) {
  return /(辣椒|小米辣|青椒|尖椒|杭椒|线椒|朝天椒|二荆条|剁椒|泡椒|豆瓣酱|辣酱|辣椒面|辣椒粉)/.test(name);
}

export function inferIngredientTagFacts(input: IngredientFactInput): IngredientTagFacts {
  const name = input.name.trim();
  const aliases = dedupeAliases(name, [...(input.aliases ?? []), ...(ingredientAliasMap[name] ?? [])]);
  return {
    proteinType: inferProteinType(name, input.categoryCode),
    isStaple: inferIsStaple(name, input.categoryCode),
    isSpicyIngredient: inferIsSpicyIngredient(name),
    aliases
  };
}
