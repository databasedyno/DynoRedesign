/**
 * Export a rendered <canvas> QR (from qrcode.react's QRCodeCanvas) to a
 * downloadable PNG, composited onto a padded white card with an optional
 * caption + "Powered by Dynopay" footer — print/invoice friendly.
 *
 * Client-only (uses document/canvas); call from event handlers.
 */
export const downloadQrPng = (
  canvas: HTMLCanvasElement | null,
  opts: { caption?: string; filename?: string } = {},
): void => {
  if (!canvas || typeof document === "undefined") return;
  const { caption = "", filename = "dynopay-payment-qr.png" } = opts;

  const PAD = 32;
  const TEXT_H = caption ? 60 : 24;
  const out = document.createElement("canvas");
  const w = canvas.width + PAD * 2;
  const h = canvas.height + PAD * 2 + TEXT_H;
  out.width = w;
  out.height = h;

  const ctx = out.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(canvas, PAD, PAD);

  ctx.textAlign = "center";
  if (caption) {
    ctx.fillStyle = "#0A0A0B";
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(caption, w / 2, canvas.height + PAD + 30);
  }
  ctx.fillStyle = "#6B7280";
  ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Powered by Dynopay", w / 2, canvas.height + PAD + (caption ? 50 : 16));

  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
};

export default downloadQrPng;
