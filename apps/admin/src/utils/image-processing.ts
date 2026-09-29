export interface ImageCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageProcessingOptions {
  source: CanvasImageSource;
  sourceRect: ImageCropRect;
  outputWidth: number;
  outputHeight: number;
  quality: number;
  fileName: string;
}

export async function processImageFile(options: ImageProcessingOptions) {
  const { source, sourceRect, outputWidth, outputHeight, quality, fileName } = options;
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("图片处理失败");

  context.drawImage(
    source,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("图片处理失败");
  return new File([blob], fileName, { type: "image/jpeg" });
}
