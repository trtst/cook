export type ImageStage = "empty" | "loading" | "loaded";

export function imageStage(src: string, loadedSrc: string): ImageStage {
  if (!src) return "empty";
  return src === loadedSrc ? "loaded" : "loading";
}
