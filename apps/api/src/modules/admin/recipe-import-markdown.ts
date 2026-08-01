import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { posix } from "node:path";
import type {
  RecipeDifficulty,
  RecipeDuration,
  RecipeImportImageSummary,
  RecipeImportIssue,
  RecipeImportParsedBody,
  RecipeImportRawBody,
  RecipeImportRecipeBody
} from "../../contracts/types";
import { buildSearchKey } from "../recipe/recipe-content";

type IngredientPick = {
  id: number;
  name: string;
  categoryId: number;
};

type UnitPick = {
  id: number;
  name: string;
};

type SourceFile = {
  sourcePath: string;
  markdown: string;
  files: Map<string, Buffer>;
};

type ImageFile = {
  key: string;
  alt: string | null;
  fileName: string;
  width: number | null;
  height: number | null;
  buffer: Buffer;
};

type ImportRefs = {
  ingredientByName: Map<string, IngredientPick>;
  unitByName: Map<string, UnitPick>;
};

type ParseResult = {
  rawBody: Omit<RecipeImportRawBody, "assetFolder" | "images">;
  parsedBody: RecipeImportParsedBody;
  recipeBody: RecipeImportRecipeBody;
  errorItems: RecipeImportIssue[];
  warnItems: RecipeImportIssue[];
  imageFiles: ImageFile[];
};

const coverRatio = 4 / 3;
const coverRatioTolerance = 0.02;
const imageExtSet = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const fuzzyAmountSet = new Set(["适量", "少许", "按需"]);
const unitAliasMap = new Map<string, string>([
  ["g", "克"],
  ["kg", "千克"],
  ["ml", "毫升"],
  ["l", "升"],
  ["tbsp", "汤匙"],
  ["tsp", "茶匙"]
]);

function readPngSize(buffer: Buffer) {
  if (
    buffer.length < 24 ||
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47 ||
    buffer.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function readJpegSize(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const blockSize = buffer.readUInt16BE(offset + 2);
    if (blockSize < 2 || offset + blockSize + 2 > buffer.length) break;
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }
    offset += blockSize + 2;
  }
  return null;
}

function readWebpSize(buffer: Buffer) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null;
  }

  const chunkType = buffer.subarray(12, 16).toString("ascii");
  if (chunkType === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }

  if (chunkType === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }

  if (chunkType === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }

  return null;
}

function readImageSize(buffer: Buffer) {
  return readPngSize(buffer) || readJpegSize(buffer) || readWebpSize(buffer);
}

function canUseAsCover(width: number | null, height: number | null) {
  if (!width || !height) return false;
  const ratio = width / height;
  return Number.isFinite(ratio) && Math.abs(ratio - coverRatio) <= coverRatioTolerance;
}

function getImportRoot() {
  return resolve(process.env.APP_ASSET_DIR || join(process.cwd(), "var", "app-assets"), "recipe-imports");
}

function cleanZipPath(value: string) {
  const text = posix.normalize(value.replace(/\\/g, "/")).replace(/^\/+/, "");
  const parts = text.split("/").filter(Boolean);
  const nextParts: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      if (nextParts.length === 0) {
        return "";
      }
      nextParts.pop();
      continue;
    }
    nextParts.push(part);
  }
  return nextParts.join("/");
}

function resolveZipAssetPath(sourcePath: string, assetRef: string) {
  const sourceDir = posix.dirname(cleanZipPath(sourcePath));
  const nextPath = sourceDir === "." ? assetRef : posix.join(sourceDir, assetRef);
  return cleanZipPath(nextPath);
}

function stripCommentText(markdown: string) {
  return markdown.replace(/<!--[\s\S]*?-->/g, "");
}

function cleanLineText(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanAssetRef(value: string) {
  return value.trim().replace(/^<|>$/g, "").split(/[?#]/)[0]?.trim() ?? "";
}

function pickDifficulty(value: string | null): RecipeDifficulty | null {
  if (!value) return null;
  const starCount = (value.match(/★/g) || []).length;
  if (starCount <= 0) return null;
  if (starCount === 1) return "BEGINNER";
  if (starCount === 2) return "EASY";
  if (starCount === 3) return "SKILLED";
  return "CHALLENGING";
}

function pickDuration(value: string | null): RecipeDuration | null {
  if (!value) return null;
  const hourRange = value.match(/(\d+(?:\.\d+)?)\s*(?:-|~|～|至)\s*(\d+(?:\.\d+)?)\s*小时/);
  if (hourRange) {
    const minutes = Number(hourRange[2]) * 60;
    return minutesToDuration(minutes);
  }
  const hourMatch = value.match(/(\d+(?:\.\d+)?)\s*小时/);
  if (hourMatch) {
    return minutesToDuration(Number(hourMatch[1]) * 60);
  }
  const minuteRange = value.match(/(\d+(?:\.\d+)?)\s*(?:-|~|～|至)\s*(\d+(?:\.\d+)?)\s*分钟/);
  if (minuteRange) {
    return minutesToDuration(Number(minuteRange[2]));
  }
  const minuteMatch = value.match(/(\d+(?:\.\d+)?)\s*分钟/);
  if (minuteMatch) {
    return minutesToDuration(Number(minuteMatch[1]));
  }
  return null;
}

function minutesToDuration(minutes: number): RecipeDuration | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes <= 15) return "WITHIN_15";
  if (minutes <= 30) return "BETWEEN_15_30";
  if (minutes <= 60) return "BETWEEN_30_60";
  return "OVER_60";
}

function pickBaseServings(value: string | null) {
  if (!value) return null;
  const patterns = [/够\s*(\d+)\s*个?人吃/, /(\d+)\s*人份/, /(\d+)\s*人食用/];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      const count = Number(match[1]);
      if (Number.isInteger(count) && count >= 1 && count <= 20) return count;
    }
  }
  return null;
}

function pickCalories(value: string | null) {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  if (!match?.[1]) return null;
  const count = Number(match[1]);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

function splitSections(markdown: string) {
  const lines = stripCommentText(markdown.replace(/^\uFEFF/, "")).split(/\r?\n/);
  let titleLine: string | null = null;
  const introLines: string[] = [];
  const sectionMap = new Map<string, string[]>();
  let currentSection = "";
  let seenSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!titleLine) {
      const titleMatch = line.match(/^#\s+(.+)$/);
      if (titleMatch?.[1]) {
        titleLine = cleanLineText(titleMatch[1]);
        continue;
      }
    }

    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch?.[1]) {
      currentSection = cleanLineText(sectionMatch[1]);
      if (!sectionMap.has(currentSection)) {
        sectionMap.set(currentSection, []);
      }
      seenSection = true;
      continue;
    }

    if (!seenSection) {
      introLines.push(line);
      continue;
    }

    if (!currentSection) continue;
    sectionMap.get(currentSection)?.push(line);
  }

  return { titleLine, introLines, sectionMap };
}

function collectStory(introLines: string[]) {
  const lines = introLines
    .map(line => cleanLineText(line))
    .filter(line => line && !line.startsWith("预估烹饪难度：") && !line.startsWith("预估卡路里："));
  return lines.join("\n") || null;
}

function collectSectionBullets(lines: string[]) {
  return lines
    .filter(line => /^\s*[-*]\s+/.test(line))
    .map(line => cleanLineText(line.replace(/^\s*[-*]\s+/, "")))
    .filter(Boolean);
}

function collectStepLines(lines: string[]) {
  const steps: string[] = [];
  for (const line of lines) {
    const text = cleanLineText(line);
    if (!text) continue;
    const stepMatch = text.match(/^\d+\.\s*(.+)$/);
    if (stepMatch?.[1]) {
      steps.push(stepMatch[1].trim());
      continue;
    }
    if (steps.length > 0) {
      steps[steps.length - 1] = `${steps[steps.length - 1]} ${text}`.trim();
    }
  }
  return steps;
}

function pickUnit(unitText: string | null, unitByName: Map<string, UnitPick>) {
  if (!unitText) return null;
  const alias = unitAliasMap.get(unitText.toLowerCase()) ?? unitText;
  return unitByName.get(buildSearchKey(alias)) ?? null;
}

function parseIngredientLine(line: string, refs: ImportRefs) {
  const tailNoteMatch = line.match(/^(.*?)(?:\s*[（(]([^()（）]+)[）)])?\s*$/);
  const main = tailNoteMatch?.[1]?.trim() || line.trim();
  const note = tailNoteMatch?.[2]?.trim() || null;

  const fuzzyMatch = main.match(/^(.+?)\s+(适量|少许|按需)$/);
  if (fuzzyMatch?.[1] && fuzzyMatch[2] && fuzzyAmountSet.has(fuzzyMatch[2])) {
    const ingredientName = fuzzyMatch[1].trim();
    const ingredient = refs.ingredientByName.get(buildSearchKey(ingredientName)) ?? null;
    return {
      line,
      ingredientName,
      ingredientId: ingredient?.id ?? null,
      quantity: null,
      unitText: null,
      unitId: null,
      fuzzyText: fuzzyMatch[2] as "适量" | "少许" | "按需",
      note
    };
  }

  const exactMatch = main.match(/^(.+?)\s+([0-9]+(?:\.[0-9]+)?(?:\s*(?:-|~|～)\s*[0-9]+(?:\.[0-9]+)?)?)\s*([A-Za-z\u4e00-\u9fa5]+)$/);
  if (exactMatch?.[1] && exactMatch[2] && exactMatch[3]) {
    const ingredientName = exactMatch[1].trim();
    const quantity = exactMatch[2].replace(/\s+/g, "");
    const unitText = exactMatch[3].trim();
    const ingredient = refs.ingredientByName.get(buildSearchKey(ingredientName)) ?? null;
    const unit = pickUnit(unitText, refs.unitByName);
    return {
      line,
      ingredientName,
      ingredientId: ingredient?.id ?? null,
      quantity,
      unitText,
      unitId: unit?.id ?? null,
      fuzzyText: null,
      note
    };
  }

  const ingredientName = main.trim();
  const ingredient = refs.ingredientByName.get(buildSearchKey(ingredientName)) ?? null;
  return {
    line,
    ingredientName,
    ingredientId: ingredient?.id ?? null,
    quantity: null,
    unitText: null,
    unitId: null,
    fuzzyText: null,
    note
  };
}

function buildItemIssues(recipeBody: RecipeImportRecipeBody, images: RecipeImportImageSummary[]) {
  const errorItems: RecipeImportIssue[] = [];
  const warnItems: RecipeImportIssue[] = [];
  const imageMap = new Map(images.map(item => [item.key, item]));

  if (!recipeBody.title.trim()) {
    errorItems.push({ field: "title", message: "未识别到菜谱名称" });
  }
  if (!recipeBody.inspirationCategoryId) {
    errorItems.push({ field: "inspirationCategoryId", message: "请选择系统菜谱分类" });
  }
  if (!recipeBody.baseServings) {
    errorItems.push({ field: "baseServings", message: "未识别到基准人数" });
  }
  if (!recipeBody.difficulty) {
    errorItems.push({ field: "difficulty", message: "未识别到难度" });
  }
  if (!recipeBody.duration) {
    errorItems.push({ field: "duration", message: "未识别到时长" });
  }
  if (recipeBody.ingredients.length === 0) {
    errorItems.push({ field: "ingredients", message: "未识别到食材清单" });
  }
  if (recipeBody.steps.length === 0) {
    errorItems.push({ field: "steps", message: "未识别到制作步骤" });
  }

  recipeBody.ingredients.forEach((item, index) => {
    const rowLabel = `ingredients.${index}`;
    if (!item.ingredientName.trim()) {
      errorItems.push({ field: `${rowLabel}.ingredientName`, message: `第 ${index + 1} 行食材名称为空` });
      return;
    }
    if (!item.ingredientId) {
      errorItems.push({ field: `${rowLabel}.ingredientId`, message: `第 ${index + 1} 行食材还未匹配系统食材` });
    }
    if (item.fuzzyText) return;
    if (!item.quantity?.trim()) {
      errorItems.push({ field: `${rowLabel}.quantity`, message: `第 ${index + 1} 行食材缺少数量` });
    } else if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
      errorItems.push({ field: `${rowLabel}.quantity`, message: `第 ${index + 1} 行食材数量不是大于 0 的单值` });
    }
    if (!item.unitId) {
      errorItems.push({ field: `${rowLabel}.unitId`, message: `第 ${index + 1} 行食材还未匹配系统单位` });
    }
  });

  recipeBody.steps.forEach((item, index) => {
    const rowLabel = `steps.${index}`;
    if (!item.text.trim() && !item.imageKey) {
      errorItems.push({ field: rowLabel, message: `第 ${index + 1} 步缺少正文或图片` });
    }
    if (item.imageKey && !imageMap.has(item.imageKey)) {
      errorItems.push({ field: `${rowLabel}.imageKey`, message: `第 ${index + 1} 步引用的图片不存在` });
    }
  });

  if (recipeBody.coverImageKey) {
    const cover = imageMap.get(recipeBody.coverImageKey);
    if (!cover) {
      errorItems.push({ field: "coverImageKey", message: "封面图片不存在" });
    } else if (!canUseAsCover(cover.width, cover.height)) {
      errorItems.push({ field: "coverImageKey", message: "当前封面图不是 4:3，不能直接发布为系统菜谱封面" });
    }
  }

  if (!recipeBody.story?.trim()) {
    warnItems.push({ field: "story", message: "未识别到菜谱故事，可按原文补充" });
  }
  if (!recipeBody.tips?.trim()) {
    warnItems.push({ field: "tips", message: "未识别到小贴士，可按原文补充" });
  }
  if (recipeBody.estimatedCalories === null) {
    warnItems.push({ field: "estimatedCalories", message: "未识别到预估卡路里" });
  }

  return { errorItems, warnItems };
}

export function readMarkdownSources(fileName: string, buffer: Buffer): SourceFile[] {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".md")) {
    return [
      {
        sourcePath: fileName,
        markdown: buffer.toString("utf8"),
        files: new Map()
      }
    ];
  }

  if (!lowerName.endsWith(".zip")) {
    throw new Error("目前只支持导入 .md 或 .zip 文件");
  }

  const AdmZip = require("adm-zip");
  const zip = new AdmZip(buffer);
  const fileMap = new Map<string, Buffer>();

  for (const entry of zip.getEntries() as Array<{ entryName: string; isDirectory: boolean; getData: () => Buffer }>) {
    if (entry.isDirectory) continue;
    const entryName = cleanZipPath(entry.entryName);
    if (!entryName || entryName.startsWith("__MACOSX/")) continue;
    fileMap.set(entryName, entry.getData());
  }

  return Array.from(fileMap.entries())
    .filter(([entryName]) => entryName.toLowerCase().endsWith(".md"))
    .map(([entryName, content]) => ({
      sourcePath: entryName,
      markdown: content.toString("utf8"),
      files: fileMap
    }));
}

export function parseMarkdownSource(source: SourceFile, defaultCategoryId: number | null, refs: ImportRefs): ParseResult {
  const { titleLine, introLines, sectionMap } = splitSections(source.markdown);
  const story = collectStory(introLines);
  const cleanTitle = titleLine?.replace(/的做法$/, "").trim() || "";
  const difficultyText =
    introLines.map(line => cleanLineText(line)).find(line => line.startsWith("预估烹饪难度："))?.replace("预估烹饪难度：", "").trim() ??
    null;
  const caloriesText =
    introLines.map(line => cleanLineText(line)).find(line => line.startsWith("预估卡路里："))?.replace("预估卡路里：", "").trim() ??
    null;

  const calcLines = sectionMap.get("计算") ?? [];
  const stepLines = collectStepLines(sectionMap.get("操作") ?? []);
  const ingredientLines = collectSectionBullets(calcLines);
  const tipLines = collectSectionBullets(sectionMap.get("附加内容") ?? []);
  const introText = introLines.map(line => cleanLineText(line)).filter(Boolean).join(" ");
  const calcText = calcLines.map(line => cleanLineText(line)).filter(Boolean).join(" ");

  const imageFiles: ImageFile[] = [];
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const imageSet = new Set<string>();
  let imageMatch: RegExpExecArray | null = imagePattern.exec(stripCommentText(source.markdown));
  while (imageMatch) {
    const alt = cleanLineText(imageMatch[1] || "") || null;
    const rawRef = cleanAssetRef(imageMatch[2] || "");
    const imagePath = resolveZipAssetPath(source.sourcePath, rawRef);
    const key = imagePath;
    if (imagePath && key && !imageSet.has(key)) {
      const fileBuffer = source.files.get(imagePath);
      if (fileBuffer) {
        const size = readImageSize(fileBuffer);
        imageFiles.push({
          key,
          alt,
          fileName: key.split("/").pop() || key,
          width: size?.width ?? null,
          height: size?.height ?? null,
          buffer: fileBuffer
        });
        imageSet.add(key);
      }
    }
    imageMatch = imagePattern.exec(stripCommentText(source.markdown));
  }

  const recipeBody: RecipeImportRecipeBody = {
    inspirationCategoryId: defaultCategoryId,
    title: cleanTitle,
    story,
    baseServings: pickBaseServings(calcText),
    difficulty: pickDifficulty(difficultyText),
    duration: pickDuration(`${story ?? ""} ${introText}`),
    estimatedCalories: pickCalories(caloriesText),
    tips: tipLines.join("\n") || null,
    coverImageKey: imageFiles.find(item => canUseAsCover(item.width, item.height))?.key ?? null,
    ingredients: ingredientLines.map(line => parseIngredientLine(line, refs)),
    steps: stepLines.map(line => ({ text: line, imageKey: null }))
  };

  const imageSummary: RecipeImportImageSummary[] = imageFiles.map(item => ({
    key: item.key,
    alt: item.alt,
    fileName: item.fileName,
    width: item.width,
    height: item.height
  }));
  const { errorItems, warnItems } = buildItemIssues(recipeBody, imageSummary);

  return {
    rawBody: {
      sourcePath: source.sourcePath,
      markdown: source.markdown
    },
    parsedBody: {
      titleLine,
      story,
      baseServingsText: cleanLineText(calcText) || null,
      difficultyText,
      durationText: introText || null,
      caloriesText,
      ingredientLines,
      stepLines,
      tipLines
    },
    recipeBody,
    errorItems,
    warnItems,
    imageFiles
  };
}

export async function writeImportImages(jobId: number, itemIndex: number, imageFiles: ImageFile[]) {
  const assetFolder = `job-${jobId}/item-${itemIndex}`;
  const assetDir = join(getImportRoot(), assetFolder);
  await mkdir(assetDir, { recursive: true });

  const images: RecipeImportImageSummary[] = [];
  for (const image of imageFiles) {
    const fileName = image.key
      .split("/")
      .filter(Boolean)
      .map(segment => segment.replace(/[^\w.-]/g, "_"))
      .join("/");
    const targetPath = join(assetDir, fileName);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, image.buffer);
    images.push({
      key: image.key,
      alt: image.alt,
      fileName,
      width: image.width,
      height: image.height
    });
  }

  return { assetFolder, images };
}

export function rebuildItemState(recipeBody: RecipeImportRecipeBody, images: RecipeImportImageSummary[]) {
  return buildItemIssues(recipeBody, images);
}

export function readSourceImages(rawBody: RecipeImportRawBody) {
  return rawBody.images.map(item => ({
    ...item,
    canUseAsCover: canUseAsCover(item.width, item.height)
  }));
}

export async function readImageBuffer(assetFolder: string, fileName: string) {
  return readFile(join(getImportRoot(), assetFolder, fileName));
}

export async function readImageDataUrl(assetFolder: string, fileName: string) {
  const buffer = await readImageBuffer(assetFolder, fileName);
  const ext = extname(fileName).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export function buildIngredientRefs(rows: IngredientPick[]) {
  return new Map(rows.map(item => [buildSearchKey(item.name), item]));
}

export function buildUnitRefs(rows: UnitPick[]) {
  return new Map(rows.map(item => [buildSearchKey(item.name), item]));
}
