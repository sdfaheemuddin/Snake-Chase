/** Turn the visible game screen into a local PNG. No network or third-party library. */
const rectIn = (element, rootRect) => {
  const r = element.getBoundingClientRect();
  return { x: r.left - rootRect.left, y: r.top - rootRect.top, w: r.width, h: r.height };
};

function panel(ctx, r, fill, stroke, radius = 10) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function text(ctx, value, x, y, size, color, weight = 700, align = 'left') {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), x, y);
}

/** Draw the game screen, including the actual canvas pixels and screen HUD. */
export function buildScreenSnapshot(root, boardCanvas) {
  const rootRect = root.getBoundingClientRect();
  const width = Math.max(1, Math.round(rootRect.width));
  const height = Math.max(1, Math.round(rootRect.height));
  const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const output = document.createElement('canvas');
  output.width = Math.round(width * ratio);
  output.height = Math.round(height * ratio);
  const ctx = output.getContext('2d');
  if (!ctx) throw new Error('This browser cannot create the sharing image.');
  ctx.scale(ratio, ratio);
  ctx.fillStyle = '#0d1914';
  ctx.fillRect(0, 0, width, height);

  // Header and actual score / speed values at their on-screen positions.
  const heading = rectIn(root.querySelector('.topbar'), rootRect);
  const brandIcon = root.querySelector('.brand-icon');
  const brandRect = rectIn(brandIcon, rootRect);
  if (brandIcon.complete && brandIcon.naturalWidth) ctx.drawImage(brandIcon, brandRect.x, brandRect.y, brandRect.w, brandRect.h);
  text(ctx, 'Snake Chase', brandRect.x + brandRect.w + 8, heading.y + 15, 18, '#f0f8f0', 850);
  text(ctx, 'One snake. Endless targets.', brandRect.x + brandRect.w + 8, heading.y + 30, 10, '#a0bba7', 500);

  for (const stat of root.querySelectorAll('.stat-card')) {
    const r = rectIn(stat, rootRect);
    panel(ctx, r, stat.classList.contains('accent-card') ? '#233f2e' : '#1d3326', '#36523e');
    const number = stat.querySelector('.stat-value').textContent;
    const label = stat.querySelector('.stat-label').textContent;
    text(ctx, number, r.x + r.w / 2, r.y + r.h * .39, 25, stat.classList.contains('accent-card') ? '#c6f9a9' : '#f0f8f0', 850, 'center');
    text(ctx, label, r.x + r.w / 2, r.y + r.h - 11, 9, '#a0bba7', 750, 'center');
  }

  const speed = rectIn(root.querySelector('.speed-panel'), rootRect);
  panel(ctx, speed, '#192d21', '#36533f');
  text(ctx, `↗ Speed level ${root.querySelector('#level').textContent}`, speed.x + 11, speed.y + 15, 12, '#c9deca');
  text(ctx, root.querySelector('#speed-value').textContent, speed.x + speed.w - 11, speed.y + 15, 12, '#ddf3d5', 700, 'right');
  text(ctx, root.querySelector('#lives').textContent, speed.x + speed.w * 0.52, speed.y + 15,
    13, '#ff918b', 800, 'center');
  const track = rectIn(root.querySelector('.progress-track'), rootRect);
  panel(ctx, track, '#385541', null, 4);
  const fill = root.querySelector('.progress-fill').getBoundingClientRect();
  if (fill.width > 0) panel(ctx, { x: track.x, y: track.y, w: fill.width, h: track.h }, '#bafa87', null, 4);
  text(ctx, root.querySelector('#progress-text').textContent, speed.x + 11, speed.y + speed.h - 9, 9, '#91ad98', 500);
  text(ctx, 'Next speed boost', speed.x + speed.w - 11, speed.y + speed.h - 9, 9, '#91ad98', 500, 'right');

  // Copy the ACTUAL snake and food frame, without rerendering or resetting the game.
  const board = rectIn(boardCanvas, rootRect);
  ctx.drawImage(boardCanvas, board.x, board.y, board.w, board.h);
  ctx.strokeStyle = '#476e52';
  ctx.lineWidth = 2;
  ctx.strokeRect(board.x, board.y, board.w, board.h);

  const status = rectIn(root.querySelector('.live-row'), rootRect);
  text(ctx, root.querySelector('#game-status').textContent, status.x + 3, status.y + status.h / 2, 11, '#bad0bc', 500);
  text(ctx, root.querySelector('#distance').textContent, status.x + status.w - 3, status.y + status.h / 2, 11, '#d1f7b9', 700, 'right');

  // Include the compact game-over badge when it is shown.
  const overlay = root.querySelector('#game-overlay');
  if (!overlay.hidden && overlay.classList.contains('game-over')) {
    const r = rectIn(overlay, rootRect);
    panel(ctx, r, 'rgba(12,28,19,.94)', '#61845d', 12);
    const image = root.querySelector('.gameover-art');
    if (image.complete && image.naturalWidth) ctx.drawImage(image, r.x + 10, r.y + (r.h - 32) / 2, 32, 32);
    text(ctx, 'GAME OVER', r.x + 50, r.y + r.h / 2, 17, '#f0f8f0', 850);
  }

  for (const button of root.querySelectorAll('.action-row button')) {
    const r = rectIn(button, rootRect);
    const share = button.id === 'share-button';
    panel(ctx, r, share ? '#a9ee88' : '#274433', share ? null : '#51745a');
    text(ctx, button.textContent.trim(), r.x + r.w / 2, r.y + r.h / 2, 12, share ? '#173522' : '#e5f3e8', 750, 'center');
  }
  return output;
}

/** Synchronous conversion preserves user activation for the Android native share sheet. */
export function canvasToPngFile(canvas, filename = 'snake-chase-score.png') {
  const imageBase64 = canvas.toDataURL('image/png').split(',')[1];
  if (!imageBase64) throw new Error('The game snapshot could not be generated.');
  const binary = atob(imageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: 'image/png' });
}
