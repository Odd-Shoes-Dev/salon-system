// Recolors a logo image to solid white (preserving its shape/transparency)
// by drawing it to a canvas and compositing with source-in. Used before
// html2canvas captures — html2canvas doesn't reliably apply CSS filter
// effects like `filter: brightness(0) invert(1)`, which print-only HTML
// relies on to show a logo in white against a brand-colored banner.
export async function recolorImageToWhite(url: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load logo'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
