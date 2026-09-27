import {
  SHARE_CARD_APP_LINK,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  type ShareCardStyle,
  type ShareStat,
} from "@/lib/share-card";

const PHOTO_SRC = "/tiles/train.webp";
const LOGO_SRC = "/svg-performance-badge.webp";

export type ShareCardDrawInput = {
  style: ShareCardStyle;
  title: string;
  stats: ShareStat[];
};

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fill();
}

async function loadImage(src: string) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  await image.decode();
  return image;
}

function antonFamily() {
  const raw =
    typeof document === "undefined"
      ? ""
      : getComputedStyle(document.documentElement).getPropertyValue("--font-anton").trim();
  return raw || "Anton, sans-serif";
}

async function ensureAnton() {
  try {
    const family = antonFamily();
    await document.fonts.load(`400 80px ${family}`);
    await document.fonts.ready;
  } catch {
    /* fallback to system */
  }
}

export async function renderShareCardBlob(input: ShareCardDrawInput): Promise<Blob> {
  await ensureAnton();
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_CARD_WIDTH;
  canvas.height = SHARE_CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  const lime = "#CBF805";
  const black = "#0a0a0a";
  const white = "#ffffff";
  const isLime = input.style === "lime";
  const isPhoto = input.style === "photo";
  const bg = isLime ? lime : black;
  const ink = isLime ? black : white;
  const accent = isLime ? black : lime;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (isPhoto) {
    try {
      const photo = await loadImage(PHOTO_SRC);
      const scale = Math.max(canvas.width / photo.width, canvas.height / photo.height);
      const w = photo.width * scale;
      const h = photo.height * scale;
      ctx.drawImage(photo, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } catch {
      ctx.fillStyle = black;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(canvas.width / 2, 270, 118, 0, Math.PI * 2);
  ctx.stroke();
  try {
    const logo = await loadImage(LOGO_SRC);
    const size = 220;
    ctx.drawImage(logo, (canvas.width - size) / 2, 160, size, size);
  } catch {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 270, 80, 0, Math.PI * 2);
    ctx.fill();
  }

  const display = antonFamily();
  ctx.textAlign = "center";
  ctx.fillStyle = accent;
  ctx.font = `400 36px ${display}`;
  ctx.letterSpacing = "0.14em";
  ctx.fillText("WORKOUT COMPLETE", canvas.width / 2, 460);

  ctx.fillStyle = ink;
  ctx.font = `400 72px ${display}`;
  ctx.letterSpacing = "0.04em";
  const title = input.title.toUpperCase();
  wrapText(ctx, title, canvas.width / 2, 560, canvas.width - 140, 78);

  const stats = input.stats.slice(0, 4);
  const cellW = 380;
  const cellH = 200;
  const gap = 36;
  const gridW = cellW * 2 + gap;
  const startX = (canvas.width - gridW) / 2;
  const startY = 860;
  stats.forEach((stat, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = startX + col * (cellW + gap);
    const y = startY + row * (cellH + gap);
    ctx.fillStyle = isLime ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, x, y, cellW, cellH, 28);
    ctx.fillStyle = isLime ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.7)";
    ctx.font = `400 28px ${display}`;
    ctx.fillText(stat.label.toUpperCase(), x + cellW / 2, y + 70);
    ctx.fillStyle = ink;
    drawStatValue(ctx, stat.value, stat.unit, x + cellW / 2, y + 145, display);
  });

  ctx.fillStyle = ink;
  ctx.font = `400 34px ${display}`;
  ctx.fillText("SVG PERFORMANCE", canvas.width / 2, 1680);
  ctx.fillStyle = isLime ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.7)";
  ctx.font = "400 28px Geist, Arial, sans-serif";
  ctx.letterSpacing = "0";
  ctx.fillText(SHARE_CARD_APP_LINK, canvas.width / 2, 1740);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Could not build the share image."));
    }, "image/png");
  });
  return blob;
}

function drawStatValue(
  ctx: CanvasRenderingContext2D,
  value: string,
  unit: string | undefined,
  centerX: number,
  y: number,
  display: string,
) {
  ctx.letterSpacing = "0.02em";
  ctx.font = `400 56px ${display}`;
  if (!unit) {
    ctx.textAlign = "center";
    ctx.fillText(value.toUpperCase(), centerX, y);
    return;
  }
  const numberWidth = ctx.measureText(value).width;
  ctx.font = `400 26px ${display}`;
  ctx.letterSpacing = "0.06em";
  const unitWidth = ctx.measureText(unit).width;
  const gap = 10;
  const start = centerX - (numberWidth + gap + unitWidth) / 2;
  ctx.textAlign = "left";
  ctx.font = `400 56px ${display}`;
  ctx.letterSpacing = "0.02em";
  ctx.fillText(value, start, y);
  ctx.font = `400 26px ${display}`;
  ctx.letterSpacing = "0.06em";
  ctx.fillText(unit, start + numberWidth + gap, y);
  ctx.textAlign = "center";
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let cursor = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, cursor);
      line = word;
      cursor += lineHeight;
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, x, cursor);
}

export async function downloadShareCard(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function shareOrDownloadCard(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    await nav.share({
      files: [file],
      title: "SVG Performance",
      text: SHARE_CARD_APP_LINK,
    });
    return "shared" as const;
  }
  await downloadShareCard(blob, filename);
  return "downloaded" as const;
}
