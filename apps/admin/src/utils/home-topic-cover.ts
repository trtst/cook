import logoAsset from "@/assets/logo.png";

const coverWidth = 1200;
const coverHeight = 900;
const coverBackgroundUrl = "https://static.trtst.com/O/uploads/home-topics/weekly-topic.jpg";
const titleFont = "CHJ-Kai";
const copyFont = "SC-Medium";

interface HomeTopicCoverInput {
  title: string;
  subTitle: string;
  periodStartDate: string;
  periodEndDate: string;
  miniCodeDataUrl: string;
}

function loadCoverImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("封面背景或小程序码加载失败，请检查图片访问权限后重试"));
    image.src = src;
  });
}

function dateText(startDate: string, endDate: string) {
  const start = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  const end = endDate.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!start || !end) throw new Error("本期周刊周期不完整，无法生成封面");
  const endPrefix = start[1] === end[1] ? "" : `${end[1]}.`;
  return `${start[1]}.${start[2]}.${start[3]}—${endPrefix}${end[2]}.${end[3]}`;
}

function imageCover(context: CanvasRenderingContext2D, image: HTMLImageElement) {
  const scale = Math.max(coverWidth / image.naturalWidth, coverHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (coverWidth - width) / 2, (coverHeight - height) / 2, width, height);
}

function whiteMiniCode(miniCode: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = miniCode.naturalWidth;
  canvas.height = miniCode.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("小程序码画布初始化失败");
  context.drawImage(miniCode, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    if (pixels.data[index + 3] === 0) continue;
    pixels.data[index] = 255;
    pixels.data[index + 1] = 255;
    pixels.data[index + 2] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function logoBounds(logo: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = logo.naturalWidth;
  canvas.height = logo.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Logo 画布初始化失败");
  context.drawImage(logo, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels.data[(y * canvas.width + x) * 4 + 3] < 16) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("Logo 图片内容为空");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function titleLines(context: CanvasRenderingContext2D, value: string, maxWidth: number, fontSize: number) {
  context.font = `500 ${fontSize}px "${titleFont}", sans-serif`;
  const lines: string[] = [];
  let line = "";
  for (const character of Array.from(value)) {
    const candidate = line + character;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function createHomeTopicCover(input: HomeTopicCoverInput) {
  const title = input.title.trim();
  const subTitle = input.subTitle.trim() || "把日常三餐，过得有滋有味";
  if (!title) throw new Error("请先填写本期标题");
  if (!input.miniCodeDataUrl.startsWith("data:image/")) throw new Error("本期小程序码暂不可用，请稍后重试");

  const [loadedTitleFonts, loadedCopyFonts] = await Promise.all([
    document.fonts.load(`500 84px "${titleFont}"`),
    document.fonts.load(`500 34px "${copyFont}"`)
  ]);
  if (!loadedTitleFonts.length || !loadedCopyFonts.length) throw new Error("封面字体加载失败，请稍后重试");
  const [background, miniCode, logo] = await Promise.all([
    loadCoverImage(coverBackgroundUrl),
    loadCoverImage(input.miniCodeDataUrl),
    loadCoverImage(logoAsset)
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = coverWidth;
  canvas.height = coverHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("封面画布初始化失败");

  imageCover(context, background);
  context.fillStyle = "rgba(8, 9, 13, 0.12)";
  context.fillRect(0, 0, coverWidth, coverHeight);

  const date = dateText(input.periodStartDate, input.periodEndDate);
  context.textAlign = "center";
  context.textBaseline = "top";
  context.font = `500 28px "${copyFont}", sans-serif`;
  context.fillStyle = "#c9664d";
  const dateCenter = 300;
  const dateWidth = Math.min(context.measureText(date).width, 330);
  context.beginPath();
  context.arc(dateCenter - dateWidth / 2 - 18, 147, 6, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fff4dd";
  context.shadowColor = "rgba(0, 0, 0, 0.5)";
  context.shadowBlur = 7;
  context.fillText(date, dateCenter, 131, 330);

  const maxTitleWidth = 900;
  let fontSize = 92;
  let lines = titleLines(context, title, maxTitleWidth, fontSize);
  while (lines.length > 2 && fontSize > 58) {
    fontSize -= 4;
    lines = titleLines(context, title, maxTitleWidth, fontSize);
  }
  if (lines.length > 2) throw new Error("标题过长，请缩短后再生成封面");
  context.font = `500 ${fontSize}px "${titleFont}", sans-serif`;
  context.fillStyle = "#fff0d1";
  const titleTop = 307;
  const lineHeight = Math.round(fontSize * 1.13);
  lines.forEach((line, index) => context.fillText(line, 550, titleTop + index * lineHeight, maxTitleWidth));

  const titleBottom = titleTop + lines.length * lineHeight;
  const ruleY = titleBottom + 23;
  context.shadowBlur = 0;
  context.fillStyle = "#a74d37";
  context.fillRect(250, ruleY, 600, 5);
  context.fillStyle = "#fff0d1";
  context.font = `500 38px "${copyFont}", sans-serif`;
  context.fillText(subTitle, 550, ruleY + 32, 900);

  context.textAlign = "left";
  context.fillStyle = "#fff0d1";
  context.font = `500 22px "${copyFont}", sans-serif`;
  context.fillText("家的味道，都在这里了", 280, 747, 650);
  context.fillStyle = "rgba(255, 244, 221, 0.92)";
  context.font = `500 22px "${copyFont}", sans-serif`;
  context.fillText("长按识别小程序码 · 一起看看这周吃什么", 280, 779, 700);

  context.shadowBlur = 0;
  const codeSize = 200;
  const codeX = 898;
  const codeY = 675;
  context.drawImage(whiteMiniCode(miniCode), codeX, codeY, codeSize, codeSize);

  const bounds = logoBounds(logo);
  const logoScale = Math.min(78 / bounds.width, 34 / bounds.height);
  const logoWidth = bounds.width * logoScale;
  const logoHeight = bounds.height * logoScale;
  const logoX = codeX + codeSize / 2 - logoWidth / 2;
  const logoY = codeY + codeSize / 2 - logoHeight / 2;
  context.drawImage(logo, bounds.left, bounds.top, bounds.width, bounds.height, logoX, logoY, logoWidth, logoHeight);

  let blob: Blob | null;
  try {
    blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.94));
  } catch {
    throw new Error("封面图片无法导出，请检查背景图跨域权限后重试");
  }
  if (!blob) throw new Error("封面导出失败，请重试");
  return new File([blob], "weekly-topic-cover.jpg", { type: "image/jpeg" });
}
