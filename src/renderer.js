/** Canvas view: renders the game model without changing its state. */
export class GameRenderer {
  constructor(canvas, boardSize, onResize = () => {}) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('Game canvas is missing.');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Your browser does not support Canvas 2D.');
    this.boardSize = boardSize;
    this.logicalWidth = boardSize;
    this.logicalHeight = boardSize;
    this.onResize = onResize;
    this.resize();
    if ('ResizeObserver' in window) {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas.parentElement);
    } else {
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    const { width, height } = this.canvas.parentElement.getBoundingClientRect();
    if (width < 20 || height < 20) return;
    // Scale uniformly by the short screen side, expanding the other world axis.
    const cssScale = Math.min(width, height) / this.boardSize;
    const logicalWidth = width / cssScale;
    const logicalHeight = height / cssScale;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    const scale = w / logicalWidth;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;
    this.onResize(logicalWidth, logicalHeight);
    if (this.lastGame) this.render(this.lastGame);
  }

  /** Screen CSS coordinates relative to the board; used for tap-origin effects. */
  screenPoint(point) {
    const canvasBounds = this.canvas.getBoundingClientRect();
    const boardBounds = this.canvas.parentElement.getBoundingClientRect();
    return {
      x: canvasBounds.left - boardBounds.left + point.x * canvasBounds.width / this.logicalWidth,
      y: canvasBounds.top - boardBounds.top + point.y * canvasBounds.height / this.logicalHeight,
    };
  }

  /** The live number is earned on tap, so it follows the head rather than the food. */
  drawHeadScore(game) {
    const display = game.config.headScore;
    if (!display?.enabled || !['playing', 'paused'].includes(game.status)) return;
    const points = game.availablePoints;
    if (points === 0 && !display.showZero) return;

    const ctx = this.ctx;
    const label = `+${points}`;
    const fontSize = 19;
    const padding = 10;
    ctx.save();
    ctx.font = `800 ${fontSize}px system-ui, sans-serif`;
    const width = ctx.measureText(label).width + padding * 2;
    const height = 31;
    const x = Math.max(5, Math.min(this.logicalWidth - width - 5, game.head.x - width / 2));
    const top = game.head.y - display.offset - height / 2;
    const y = top < 5 ? game.head.y + 18 : Math.min(top, this.logicalHeight - height - 5);
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 10);
    ctx.fillStyle = points >= 75 ? 'rgba(35,78,42,.94)' : 'rgba(13,40,27,.88)';
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = points >= 75 ? '#b0ff8e' : points ? '#e2c875' : '#789b84';
    ctx.stroke();
    ctx.fillStyle = points >= 75 ? '#c5ffac' : points ? '#ffe199' : '#b4cabc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + height / 2 + 1);
    ctx.restore();
  }

  circle(x, y, radius, fill) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  render(game, timestamp = 0) {
    const ctx = this.ctx;
    this.lastGame = game;
    const W = this.logicalWidth;
    const H = this.logicalHeight;
    const { food, head, direction, trail } = game;
    const c = game.config;
    const radius = game.scoringRadius;
    const boosted = game.speedBurstActive;

    ctx.fillStyle = '#10241b';
    ctx.fillRect(0, 0, W, H);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(163,215,169,.07)';
    ctx.lineWidth = 1;
    for (let v = 20; v < Math.max(W, H); v += 20) {
      if (v < W) { ctx.moveTo(v, 0); ctx.lineTo(v, H); }
      if (v < H) { ctx.moveTo(0, v); ctx.lineTo(W, v); }
    }
    ctx.stroke();

    // Scoring circle starts at the configurable radius; closer taps score more.
    const gradient = ctx.createRadialGradient(food.x, food.y, c.collisionRadius, food.x, food.y, radius);
    gradient.addColorStop(0, 'rgba(129,245,155,.25)');
    gradient.addColorStop(.55, 'rgba(138,216,125,.09)');
    gradient.addColorStop(1, 'rgba(235,182,78,.035)');
    this.circle(food.x, food.y, radius, gradient);
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = '#d7b65d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(food.x, food.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    this.circle(food.x, food.y, c.collisionRadius, 'rgba(255,96,81,.13)');
    ctx.beginPath();
    ctx.arc(food.x, food.y, c.collisionRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,103,91,.48)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.shadowColor = '#ff584d';
    ctx.shadowBlur = 22;
    this.circle(food.x, food.y, 12, '#ff655a');
    ctx.restore();
    this.circle(food.x - 3, food.y - 3, 3, '#ffbbb2');
    ctx.save();
    ctx.translate(food.x + 2, food.y - 12);
    ctx.rotate(-.5);
    ctx.fillStyle = '#b0ed8b';
    ctx.beginPath();
    ctx.ellipse(0, -4, 5, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Preserve the same snake and trail; a burst changes the whole snake to a
    // glowing orange-gold palette so the faster movement is unmistakable.
    if (trail.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i += 1) ctx.lineTo(trail[i].x, trail[i].y);
      ctx.lineWidth = boosted ? 23 : 20;
      ctx.strokeStyle = boosted ? '#b65320' : '#307d58';
      if (boosted) {
        ctx.shadowColor = 'rgba(255,166,65,.65)';
        ctx.shadowBlur = 18;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 13;
      ctx.strokeStyle = boosted ? '#ffac53' : '#77d996';
      ctx.stroke();
    }

    const perpendicular = { x: -direction.y, y: direction.x };
    ctx.save();
    ctx.shadowColor = boosted ? 'rgba(255,191,79,.9)' : 'rgba(154,255,161,.5)';
    ctx.shadowBlur = boosted ? 24 : 11;
    this.circle(head.x, head.y, 13, boosted ? '#ffe078' : '#b6f89e');
    ctx.restore();
    for (const side of [-1, 1]) {
      const ex = head.x + direction.x * 5 + perpendicular.x * side * 6;
      const ey = head.y + direction.y * 5 + perpendicular.y * side * 6;
      this.circle(ex, ey, 2.7, '#193d2a');
      this.circle(ex + direction.x, ey + direction.y, 1, '#fff');
    }

    if (game.status === 'playing' && game.availablePoints >= 75) {
      ctx.save();
      ctx.strokeStyle = `rgba(179,255,148,${0.35 + 0.16 * Math.sin(timestamp / 95)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(food.x, food.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    this.drawHeadScore(game);
  }
}
