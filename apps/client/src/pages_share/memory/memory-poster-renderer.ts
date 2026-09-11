import { MEMORY_POSTER_TEMPLATE, type MemoryPosterView } from "./memory-poster";

interface PosterGradient {
  addColorStop(offset: number, color: string): void;
}

interface PosterContext {
  fillStyle: string | PosterGradient;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textBaseline: string;
  save(): void;
  restore(): void;
  beginPath(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  clip(): void;
  fill(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: unknown, x: number, y: number, width: number, height: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): PosterGradient;
  fillText(value: string, x: number, y: number): void;
  measureText(value: string): { width: number };
}

export interface MemoryPosterAssets {
  logo: unknown;
  cover: unknown | null;
  miniCode: unknown;
}

const { fonts } = MEMORY_POSTER_TEMPLATE;
type PosterColors = Record<keyof typeof MEMORY_POSTER_TEMPLATE.colors, string>;

function font(size: number, family: "title" | "body" = "body", weight = 400) {
  return `${weight} ${size}px ${fonts[family]}`;
}

function rule(ctx: PosterContext, y: number, color: string = MEMORY_POSTER_TEMPLATE.colors.line) {
  ctx.beginPath();
  ctx.moveTo(72, y);
  ctx.lineTo(1008, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function label(ctx: PosterContext, value: string, x: number, y: number, size: number, color: string = MEMORY_POSTER_TEMPLATE.colors.text, family: "title" | "body" = "body", weight = 400) {
  ctx.fillStyle = color;
  ctx.font = font(size, family, weight);
  ctx.fillText(value, x, y);
}

function roleLabel(role: MemoryPosterView["participants"][number]["role"]) {
  if (role === "ORGANIZER") return "主理人";
  if (role === "PARTICIPANT") return "参与人";
  return "来客";
}

export function drawMemoryPoster(ctx: PosterContext, view: MemoryPosterView, assets: MemoryPosterAssets, palette: Partial<PosterColors> = {}) {
  const colors = { ...MEMORY_POSTER_TEMPLATE.colors, ...palette };
  ctx.textBaseline = "top";
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, 1080, view.height);
  ctx.drawImage(assets.logo, 72, 54, 190, 80);
  label(ctx, "活动回忆卡", 832, 78, 25, colors.accent);
  rule(ctx, 165, colors.line);

  label(ctx, view.title, 72, 205, 66, colors.text, "title", 600);
  label(ctx, view.metaText, 72, 300, 25, colors.muted);
  let y = 360;

  if (view.showCover && assets.cover) {
    ctx.drawImage(assets.cover, 72, y, 936, 505);
    y += 535;
    label(ctx, "从厨房的热气，到餐桌上的相聚。", 72, y, 23, colors.muted);
    y += 76;
  }

  rule(ctx, y, colors.line);
  y += 37;
  label(ctx, "这顿吃了什么", 72, y, 29, colors.accent);
  label(ctx, `${view.menuItems.length}道菜`, 900, y + 4, 22, colors.muted);
  y += 68;

  view.menuRows.forEach((row, rowIndex) => {
    row.forEach((name, columnIndex) => {
      const index = rowIndex * 2 + columnIndex;
      const x = columnIndex === 0 ? 72 : 562;
      label(ctx, String(index + 1).padStart(2, "0"), x, y + 8, 21, colors.muted);
      label(ctx, name, x + 58, y, 32);
      ctx.beginPath();
      ctx.moveTo(x, y + 66);
      ctx.lineTo(x + 430, y + 66);
      ctx.strokeStyle = colors.line;
      ctx.stroke();
    });
    y += 96;
  });

  if (view.showParticipants) {
    y += 20;
    label(ctx, "一起吃饭的人", 72, y, 28, colors.accent);
    y += 62;
    view.participantRows.forEach(row => {
      row.forEach((participant, index) => {
        const x = 72 + index * 238;
        label(ctx, participant.displayName, x, y, 30);
        label(ctx, roleLabel(participant.role), x, y + 49, 20, colors.muted);
      });
      y += 90;
    });
  }

  if (view.showCaption) {
    y += 14;
    label(ctx, "这次回忆", 72, y, 28, colors.accent);
    y += 48;
    ctx.fillStyle = colors.accent;
    ctx.fillRect(72, y, 4, Math.max(70, view.captionLines.length * 46));
    view.captionLines.forEach((captionLine, index) => {
      label(ctx, `${index === 0 ? "“" : ""}${captionLine}${index === view.captionLines.length - 1 ? "”" : ""}`, 105, y + index * 46, 31, colors.text, "title", 600);
    });
  }

  const footerY = view.footerY;
  const footerTint = ctx.createLinearGradient(0, footerY - 82, 0, view.height);
  footerTint.addColorStop(0, "rgba(255, 255, 255, 0)");
  footerTint.addColorStop(1, colors.orb);
  ctx.fillStyle = footerTint;
  ctx.fillRect(0, footerY - 82, 1080, view.height - footerY + 82);
  if (view.showParticipants || view.showCaption) {
    rule(ctx, footerY, colors.line);
  }
  label(ctx, "家的味道，都在这里了", 72, footerY + 52, 31, colors.text);
  label(ctx, "长按识别小程序码 · 看看这次相聚", 72, footerY + 108, 22, colors.muted);
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.arc(912, footerY + 125, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(assets.miniCode, 827, footerY + 40, 170, 170);
}
