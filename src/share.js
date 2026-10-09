/** High-resolution score snapshot, preserving the game frame and omitting controls. */
const rectIn = (element, rootRect) => {
  const r = element.getBoundingClientRect();
  return { x: r.left - rootRect.left, y: r.top - rootRect.top, w: r.width, h: r.height };
};

function roundedPanel(ctx, r, fill, stroke, radius = 10) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, Math.min(radius, r.w / 2, r.h / 2));
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function drawLabel(ctx, value, x, y, size, color, weight = 700, align = 'left') {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), x, y);
}

/**
 * Export the actual board and HUD at up to 3x resolution. The output is cropped
 * BEFORE the action buttons, so neither Restart nor Share Score appears in PNGs.
 * Rendering directly at higher resolution avoids low-quality DOM screenshots.
 */
export function buildScreenSnapshot(root, boardCanvas) {
  if (!root || !boardCanvas) throw new TypeError('Game screen or canvas is missing.');
  const rootRect = root.getBoundingClientRect();
  const actionRow = root.querySelector('.action-row');
  if (!actionRow) throw new Error('Game action row is missing.');
  const width = Math.max(1, Math.round(rootRect.width));
  const height = Math.max(1, Math.round(actionRow.getBoundingClientRect().top - rootRect.top - 2));
  const scale = Math.min(3, 1800 / width); // Full HD+ for phones, bounded on desktops.
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(width * scale));
  output.height = Math.max(1, Math.round(height * scale));
  const ctx = output.getContext('2d');
  if (!ctx) throw new Error('This browser cannot create a sharing image.');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#0d1914';
  ctx.fillRect(0, 0, width, height);

  // Screen header, keeping actual location and visible text.
  const heading = rectIn(root.querySelector('.topbar'), rootRect);
  const brandIcon = root.querySelector('.brand-icon');
  const brand = rectIn(brandIcon, rootRect);
  if (brandIcon.complete && brandIcon.naturalWidth) {
    ctx.drawImage(brandIcon, brand.x, brand.y, brand.w, brand.h);
  }
  const brandX = brand.x + brand.w + 8;
  drawLabel(ctx, 'Snake Chase', brandX, heading.y + Math.min(heading.h * .34, 22),
    Math.min(24, Math.max(18, brand.h * .52)), '#f0f8f0', 850);
  drawLabel(ctx, 'One snake. Endless targets.', brandX,
    heading.y + Math.min(heading.h * .76, 43), 11, '#a0bba7', 500);

  // Actual stats from the finished game.
  for (const stat of root.querySelectorAll('.stat-card')) {
    const r = rectIn(stat, rootRect);
    const accented = stat.classList.contains('accent-card');
    roundedPanel(ctx, r, accented ? '#233f2e' : '#1d3326', '#36523e');
    const number = stat.querySelector('.stat-value');
    const label = stat.querySelector('.stat-label');
    const numberSize = Math.min(36, Math.max(20, parseFloat(getComputedStyle(number).fontSize) || 25));
    const labelSize = Math.min(15, Math.max(11, parseFloat(getComputedStyle(label).fontSize) || 12));
    drawLabel(ctx, number.textContent, r.x + r.w / 2, r.y + r.h * .36,
      numberSize, accented ? '#c6f9a9' : '#f0f8f0', 850, 'center');
    drawLabel(ctx, label.textContent, r.x + r.w / 2, r.y + r.h * .78,
      labelSize, '#a0bba7', 780, 'center');
  }

  // Big, readable speed level, lives, progress, and active scoring radius.
  const speed = rectIn(root.querySelector('.speed-panel'), rootRect);
  roundedPanel(ctx, speed, '#192d21', '#36533f');
  const speedSize = Math.min(19, Math.max(14, parseFloat(getComputedStyle(root.querySelector('.speed-row')).fontSize) || 16));
  drawLabel(ctx, `Speed level ${root.querySelector('#level').textContent}`,
    speed.x + 12, speed.y + 19, speedSize, '#d8f5d5', 800);
  drawLabel(ctx, root.querySelector('#speed-value').textContent,
    speed.x + speed.w - 12, speed.y + 19, speedSize, '#d9f9c4', 800, 'right');
  drawLabel(ctx, `${root.querySelector('#lives').textContent.trim()}  ${root.querySelector('#lives-count').textContent}`,
    speed.x + speed.w * .5, speed.y + 19, Math.max(12, speedSize - 2), '#ff9992', 850, 'center');

  const track = rectIn(root.querySelector('.progress-track'), rootRect);
  roundedPanel(ctx, track, '#385541', null, 4);
  const progressWidth = root.querySelector('.progress-fill').getBoundingClientRect().width;
  if (progressWidth > 1) roundedPanel(ctx,
    { x: track.x, y: track.y, w: Math.min(track.w, progressWidth), h: track.h }, '#bafa87', null, 4);
  const bottomY = speed.y + speed.h - 12;
  drawLabel(ctx, root.querySelector('#progress-text').textContent,
    speed.x + 12, bottomY, 12, '#b0c8b6', 600);
  drawLabel(ctx, `Radius ${root.querySelector('#radius-value').textContent} px`,
    speed.x + speed.w - 12, bottomY, 12, '#b0c8b6', 600, 'right');

  // Copy the ACTUAL high-DPI snake canvas; no synthetic placeholder graphics.
  const board = rectIn(boardCanvas, rootRect);
  ctx.drawImage(boardCanvas, board.x, board.y, board.w, board.h);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#476e52';
  ctx.strokeRect(board.x, board.y, board.w, board.h);

  // Keep the status (and food distance) exactly as displayed.
  const status = rectIn(root.querySelector('.live-row'), rootRect);
  const statusSize = Math.min(14, Math.max(11,
    parseFloat(getComputedStyle(root.querySelector('.live-row')).fontSize) || 12));
  drawLabel(ctx, root.querySelector('#game-status').textContent,
    status.x + 3, status.y + status.h / 2, statusSize, '#bad0bc', 500);
  drawLabel(ctx, root.querySelector('#distance').textContent,
    status.x + status.w - 3, status.y + status.h / 2, statusSize, '#d1f7b9', 750, 'right');

  // Game-over is only the small badge, with the food and snake unobscured.
  const overlay = root.querySelector('#game-overlay');
  if (!overlay.hidden && overlay.classList.contains('game-over')) {
    const r = rectIn(overlay, rootRect);
    roundedPanel(ctx, r, 'rgba(12,28,19,.95)', '#61845d', 12);
    const icon = root.querySelector('.gameover-art');
    if (icon.complete && icon.naturalWidth) ctx.drawImage(icon,
      r.x + 10, r.y + (r.h - 32) / 2, 32, 32);
    drawLabel(ctx, 'GAME OVER', r.x + 50, r.y + r.h / 2, 19, '#f0f8f0', 850);
  }

  // Intentionally NO action buttons or install controls.
  return output;
}

/** Synchronous conversion preserves user activation for the Android share sheet. */
export function canvasToPngFile(canvas, filename = 'snake-chase-score.png') {
  const imageBase64 = canvas.toDataURL('image/png').split(',')[1];
  if (!imageBase64) throw new Error('The game snapshot could not be generated.');
  const binary = atob(imageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: 'image/png' });
}
