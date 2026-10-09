/** Canvas view: renders the game model without changing its state. */
export class GameRenderer {
  constructor(canvas, boardSize) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('Game canvas is missing.');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Your browser does not support Canvas 2D.');
    this.boardSize = boardSize;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const pixels = Math.round(this.boardSize * dpr);
    this.canvas.width = pixels;
    this.canvas.height = pixels;
    this.ctx.setTransform(pixels / this.boardSize, 0, 0, pixels / this.boardSize, 0, 0);
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
    const S = this.boardSize;
    const { food, head, direction, trail } = game;
    const c = game.config;
    const radius = game.scoringRadius;

    ctx.fillStyle = '#10241b';
    ctx.fillRect(0, 0, S, S);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(163,215,169,.07)';
    ctx.lineWidth = 1;
    for (let v = 20; v < S; v += 20) {
      ctx.moveTo(v, 0); ctx.lineTo(v, S);
      ctx.moveTo(0, v); ctx.lineTo(S, v);
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

    // Draw the *same* body trail across turns and consecutive foods.
    if (trail.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i += 1) ctx.lineTo(trail[i].x, trail[i].y);
      ctx.lineWidth = 20;
      ctx.strokeStyle = '#307d58';
      ctx.stroke();
      ctx.lineWidth = 13;
      ctx.strokeStyle = '#77d996';
      ctx.stroke();
    }

    const perpendicular = { x: -direction.y, y: direction.x };
    ctx.save();
    ctx.shadowColor = 'rgba(154,255,161,.5)';
    ctx.shadowBlur = 11;
    this.circle(head.x, head.y, 13, '#b6f89e');
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
  }
}
