import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { sanitizeContentHtml } from "../src/modules/admin/content-html";
import { markdownToRichText } from "../src/modules/admin/markdown-rich-text";

loadLocalEnv();

type ChannelCode = "KITCHEN" | "COOK" | "FOOD";

interface HowToCookArticleSeed {
  title: string;
  sourcePath: string;
  slug: string;
  channelCode: ChannelCode | null;
  sortOrder: number;
}

const sourceRoot = "https://raw.githubusercontent.com/Anduin2017/HowToCook/master";
const dryRun = process.argv.includes("--dry-run");
const withoutChannel = process.argv.includes("--without-channel");

const channelSeeds: Array<{ code: ChannelCode; name: string; description: string; sortOrder: number }> = [
  { code: "KITCHEN", name: "厨房百事", description: "用什么、怎么买、怎么存、怎么备", sortOrder: 6 },
  { code: "COOK", name: "烹调技法", description: "怎么做、为什么这样做、失败怎么救", sortOrder: 7 },
  { code: "FOOD", name: "食养风物", description: "怎么吃更合适，以及节气、地域、食材故事", sortOrder: 8 }
];

const articleSeeds: HowToCookArticleSeed[] = [
  { title: "厨房准备", sourcePath: "tips/厨房准备.md", slug: "howtocook-kitchen-prep", channelCode: "KITCHEN", sortOrder: 10 },
  { title: "去腥", sourcePath: "tips/learn/去腥.md", slug: "howtocook-deodorizing", channelCode: "COOK", sortOrder: 20 },
  { title: "学习焯水", sourcePath: "tips/learn/学习焯水.md", slug: "howtocook-blanching", channelCode: "COOK", sortOrder: 30 },
  { title: "学习炒与煎", sourcePath: "tips/learn/学习炒与煎.md", slug: "howtocook-stir-fry-pan-fry", channelCode: "COOK", sortOrder: 40 },
  { title: "学习凉拌", sourcePath: "tips/learn/学习凉拌.md", slug: "howtocook-cold-dish", channelCode: "COOK", sortOrder: 50 },
  { title: "学习腌", sourcePath: "tips/learn/学习腌.md", slug: "howtocook-marinate", channelCode: "COOK", sortOrder: 60 },
  { title: "学习蒸", sourcePath: "tips/learn/学习蒸.md", slug: "howtocook-steam", channelCode: "COOK", sortOrder: 70 },
  { title: "学习煮", sourcePath: "tips/learn/学习煮.md", slug: "howtocook-boil", channelCode: "COOK", sortOrder: 80 },
  { title: "辅料技巧", sourcePath: "tips/advanced/辅料技巧.md", slug: "howtocook-condiment-skills", channelCode: "KITCHEN", sortOrder: 90 },
  { title: "糖色的炒制", sourcePath: "tips/advanced/糖色的炒制.md", slug: "howtocook-caramel-color", channelCode: "COOK", sortOrder: 100 },
  { title: "油温判断技巧", sourcePath: "tips/advanced/油温判断技巧.md", slug: "howtocook-oil-temperature", channelCode: "COOK", sortOrder: 110 }
];

function buildSourceUrl(sourcePath: string) {
  return encodeURI(`${sourceRoot}/${sourcePath}`);
}

function buildSummary(title: string, text: string) {
  const body = text.startsWith(title) ? text.slice(title.length) : text;
  return body.replace(/\s+/g, " ").trim().slice(0, 120) || title;
}

async function fetchMarkdown(seed: HowToCookArticleSeed) {
  const response = await fetch(buildSourceUrl(seed.sourcePath));
  if (!response.ok) {
    throw new Error(`读取 HowToCook 文章失败：${seed.sourcePath} HTTP ${response.status}`);
  }
  return response.text();
}

async function ensureChannels(prisma: PrismaClient) {
  await prisma.siteContentChannel.createMany({
    data: channelSeeds,
    skipDuplicates: true
  });
  const channels = await prisma.siteContentChannel.findMany({
    where: {
      code: {
        in: channelSeeds.map(item => item.code)
      }
    },
    select: {
      id: true,
      code: true,
      name: true
    }
  });
  return new Map(channels.map(item => [item.code, item]));
}

async function importArticle(prisma: PrismaClient, seed: HowToCookArticleSeed, markdown: string, channelMap: Awaited<ReturnType<typeof ensureChannels>>) {
  const channel = seed.channelCode ? channelMap.get(seed.channelCode) : null;
  if (seed.channelCode && !channel) throw new Error(`缺少文章栏目：${seed.channelCode}`);

  const converted = markdownToRichText(markdown);
  const title = seed.title.slice(0, 80);
  const bodyHtml = sanitizeContentHtml(converted.html);
  const bodyText = converted.text;
  const summary = buildSummary(title, bodyText);
  const existing = await prisma.siteContent.findUnique({
    where: { slug: seed.slug },
    select: { id: true, status: true }
  });

  if (existing && existing.status !== "DRAFT") {
    throw new Error(`文章 ${seed.slug} 已是 ${existing.status}，请先人工确认后再导入`);
  }

  if (existing && !process.argv.includes("--overwrite-draft")) {
    return { action: "skipped", id: existing.id, title, channelName: "保持现有草稿" };
  }

  const data = {
    type: "ARTICLE" as const,
    status: "DRAFT" as const,
    channelId: withoutChannel ? null : channel?.id ?? null,
    slug: seed.slug,
    path: `/guides/${seed.slug}`,
    title,
    summary,
    keywords: null,
    label: withoutChannel ? "待归类" : channel?.name ?? "待归类",
    heroNote: null,
    coverImageUrl: null,
    bodyHtml,
    bodyText,
    effectiveAt: null,
    publishedAt: null,
    sortOrder: seed.sortOrder,
    updatedByAdminId: null
  };

  if (!existing) {
    const created = await prisma.siteContent.create({
      data,
      select: { id: true }
    });
    return { action: "created", id: created.id, title, channelName: data.label };
  }

  const updated = await prisma.siteContent.update({
    where: { id: existing.id },
    data: {
      ...data,
      version: { increment: 1 }
    },
    select: { id: true }
  });
  return { action: "updated", id: updated.id, title, channelName: data.label };
}

async function main() {
  const sources = await Promise.all(articleSeeds.map(async seed => ({ seed, markdown: await fetchMarkdown(seed) })));
  if (dryRun) {
    sources.forEach(({ seed, markdown }) => {
      const converted = markdownToRichText(markdown);
      const bodyHtml = sanitizeContentHtml(converted.html);
      const channelCode = withoutChannel ? "NO_CHANNEL" : seed.channelCode ?? "NO_CHANNEL";
      console.log(`${seed.title}\t${channelCode}\t${seed.slug}\t${bodyHtml.length} html chars\t${converted.text.length} text chars`);
    });
    return;
  }

  const prisma = new PrismaClient();
  try {
    const channelMap = await ensureChannels(prisma);
    for (const source of sources) {
      const result = await importArticle(prisma, source.seed, source.markdown, channelMap);
      console.log(`${result.action}\t${result.id}\t${result.channelName}\t${result.title}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
