// Görselleri tarayıcıda hazırlar: boyutlandırma, kırpma ve WebP'ye dönüştürme.
// Tarayıcı WebP kodlayamıyorsa PNG'ye düşer. Dosya adı içerik özetinden gelir, önbellek sorunu olmaz.

export const ACCEPT = ["image/png", "image/jpeg", "image/webp"];
const MAX_INPUT_MB = 20;
const QUALITY = 0.85;

// logo: kare, 512 px; cover: 16:9, en çok 1920 px; screenshot: uzun kenar en çok 1920 px.
export const IMAGE_RULES = {
  logo: { min: 256, size: 512 },
  cover: { minWidth: 1280, width: 1920 },
  screenshot: { minEdge: 480, maxEdge: 1920 },
};

export class ImageError extends Error {
  constructor(code, params = {}) {
    super(code);
    this.code = code;
    this.params = params;
  }
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Dosyayı türüne göre hazırlar → { bytes, ext, type, width, height, url (önizleme adresi) }. */
export async function processImage(file, kind) {
  if (!ACCEPT.includes(file.type)) throw new ImageError("image_type");
  if (file.size > MAX_INPUT_MB * 1024 * 1024) throw new ImageError("image_too_big", { mb: MAX_INPUT_MB });
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError("image_unreadable");
  }
  const { width: w, height: h } = bitmap;
  let sx = 0, sy = 0, sw = w, sh = h, outW, outH;
  if (kind === "logo") {
    const side = Math.min(w, h);
    if (side < IMAGE_RULES.logo.min) throw new ImageError("image_too_small", { min: "256×256" });
    sx = (w - side) / 2; sy = (h - side) / 2; sw = sh = side;
    outW = outH = Math.min(IMAGE_RULES.logo.size, side);
  } else if (kind === "cover") {
    if (w < IMAGE_RULES.cover.minWidth) throw new ImageError("image_too_small", { min: "1280 px" });
    if (w / h > 16 / 9) { sw = Math.round(h * 16 / 9); sx = (w - sw) / 2; }
    else { sh = Math.round(w * 9 / 16); sy = (h - sh) / 2; }
    outW = Math.min(IMAGE_RULES.cover.width, sw);
    outH = Math.round(outW * 9 / 16);
  } else {
    if (Math.max(w, h) < IMAGE_RULES.screenshot.minEdge) throw new ImageError("image_too_small", { min: "480 px" });
    const scale = Math.min(1, IMAGE_RULES.screenshot.maxEdge / Math.max(w, h));
    outW = Math.round(w * scale);
    outH = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH);
  bitmap.close?.();

  let blob = await toBlob(canvas, "image/webp", QUALITY);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/png");
  if (!blob) throw new ImageError("image_unreadable");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    bytes, type: blob.type, ext: blob.type === "image/webp" ? "webp" : "png",
    width: outW, height: outH, url: URL.createObjectURL(blob),
  };
}

/** İçeriğin SHA-256 özetinin ilk 8 onaltılık hanesi (dosya adı için). */
export async function shortHash(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest.slice(0, 4)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
