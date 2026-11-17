import {
  BIRD_RADIUS,
  BIRD_X,
  BirdState,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  Cloud,
  GROUND_HEIGHT,
  PIPE_WIDTH,
  PLAYABLE_HEIGHT,
  Particle,
  PipePair,
} from './types';

export interface RenderFrameParams {
  ctx: CanvasRenderingContext2D;
  bird: BirdState;
  pipes: PipePair[];
  clouds: Cloud[];
  particles: Particle[];
  groundOffset: number;
  cityOffset: number;
  score: number;
  flashAlpha: number;
  shakeX: number;
  shakeY: number;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawSky(ctx: CanvasRenderingContext2D, score: number) {
  // Subtle warmth progression as score climbs (cycles smoothly every 30 points)
  const cycle = Math.sin((score / 30) * Math.PI) ** 2;

  const skyGrad = ctx.createLinearGradient(0, 0, 0, PLAYABLE_HEIGHT);
  if (cycle < 0.5) {
    skyGrad.addColorStop(0, '#38BDF8'); // Sky 400
    skyGrad.addColorStop(0.62, '#BAE6FD'); // Sky 200
    skyGrad.addColorStop(1, '#FEF9C3'); // Soft sunlit horizon
  } else {
    skyGrad.addColorStop(0, '#0284C7'); // Deep clear sky
    skyGrad.addColorStop(0.58, '#7DD3FC');
    skyGrad.addColorStop(1, '#FDE68A'); // Warm golden horizon
  }

  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, PLAYABLE_HEIGHT);

  // Soft sunlit orb in upper-right sky
  const sunX = CANVAS_WIDTH - 74;
  const sunY = 84;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 72);
  sunGlow.addColorStop(0, 'rgba(255, 251, 235, 0.95)');
  sunGlow.addColorStop(0.35, 'rgba(254, 240, 138, 0.45)');
  sunGlow.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 72, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloud(ctx: CanvasRenderingContext2D, cloud: Cloud) {
  ctx.save();
  ctx.translate(cloud.x, cloud.y);
  ctx.scale(cloud.scale, cloud.scale);
  ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`;

  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.arc(18, -6, 22, 0, Math.PI * 2);
  ctx.arc(38, -2, 17, 0, Math.PI * 2);
  ctx.arc(52, 4, 13, 0, Math.PI * 2);
  ctx.arc(-14, 5, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawDistantHorizon(ctx: CanvasRenderingContext2D, cityOffset: number) {
  // Distant rolling hills
  ctx.fillStyle = '#93C5FD';
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(0, PLAYABLE_HEIGHT);
  for (let x = 0; x <= CANVAS_WIDTH + 40; x += 40) {
    const hillY =
      PLAYABLE_HEIGHT - 54 - Math.sin((x + cityOffset * 0.4) * 0.018) * 16;
    ctx.lineTo(x, hillY);
  }
  ctx.lineTo(CANVAS_WIDTH, PLAYABLE_HEIGHT);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Soft stylized skyline silhouette
  const patternWidth = 240;
  const buildings = [
    { x: 6, w: 28, h: 48 },
    { x: 38, w: 22, h: 68 },
    { x: 64, w: 34, h: 42 },
    { x: 102, w: 26, h: 78 },
    { x: 132, w: 30, h: 52 },
    { x: 166, w: 24, h: 62 },
    { x: 194, w: 38, h: 44 },
  ];

  const startOffset = -(cityOffset % patternWidth);
  ctx.fillStyle = 'rgba(148, 197, 232, 0.55)';
  for (let repeat = 0; repeat < 3; repeat++) {
    const baseX = startOffset + repeat * patternWidth;
    for (const b of buildings) {
      ctx.fillRect(baseX + b.x, PLAYABLE_HEIGHT - b.h, b.w, b.h);
    }
  }

  // Lush mid-ground bushes along horizon
  const bushWidth = 60;
  const bushStart = -((cityOffset * 1.35) % bushWidth);
  ctx.fillStyle = '#6EE7B7';
  for (let x = bushStart - bushWidth; x < CANVAS_WIDTH + bushWidth; x += bushWidth) {
    ctx.beginPath();
    ctx.arc(x + 15, PLAYABLE_HEIGHT - 6, 18, Math.PI, 0);
    ctx.arc(x + 36, PLAYABLE_HEIGHT - 10, 22, Math.PI, 0);
    ctx.arc(x + 54, PLAYABLE_HEIGHT - 5, 16, Math.PI, 0);
    ctx.fill();
  }
}

function drawSinglePipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  isTop: boolean
) {
  if (height <= 0) return;

  const lipHeight = 26;
  const lipOverhang = 5;

  // Pipe body gradient (3D cylindrical sheen)
  const bodyGrad = ctx.createLinearGradient(x, 0, x + width, 0);
  bodyGrad.addColorStop(0, '#15803D'); // Dark left edge
  bodyGrad.addColorStop(0.22, '#22C55E'); // Bright highlight
  bodyGrad.addColorStop(0.45, '#4ADE80'); // Specular strip
  bodyGrad.addColorStop(0.8, '#16A34A'); // Mid green
  bodyGrad.addColorStop(1, '#14532D'); // Deep right shadow

  ctx.fillStyle = bodyGrad;
  ctx.fillRect(x, y, width, height);

  // Subtle vertical specular highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(x + 10, y, 7, height);

  // Crisp dark emerald outline on shaft
  ctx.strokeStyle = '#14532D';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  // Pipe rim / cap
  const lipY = isTop ? y + height - lipHeight : y;
  const lipX = x - lipOverhang;
  const lipW = width + lipOverhang * 2;

  const lipGrad = ctx.createLinearGradient(lipX, 0, lipX + lipW, 0);
  lipGrad.addColorStop(0, '#15803D');
  lipGrad.addColorStop(0.22, '#22C55E');
  lipGrad.addColorStop(0.45, '#86EFAC');
  lipGrad.addColorStop(0.82, '#16A34A');
  lipGrad.addColorStop(1, '#14532D');

  drawRoundedRect(ctx, lipX, lipY, lipW, lipHeight, 5);
  ctx.fillStyle = lipGrad;
  ctx.fill();

  ctx.strokeStyle = '#14532D';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner rim shadow line
  ctx.fillStyle = 'rgba(20, 83, 45, 0.25)';
  if (isTop) {
    ctx.fillRect(x + 1, lipY - 4, width - 2, 4);
  } else {
    ctx.fillRect(x + 1, lipY + lipHeight, width - 2, 4);
  }
}

function drawPipes(ctx: CanvasRenderingContext2D, pipes: PipePair[]) {
  for (const pipe of pipes) {
    const topPipeHeight = pipe.gapY - pipe.gapHeight / 2;
    const bottomPipeY = pipe.gapY + pipe.gapHeight / 2;
    const bottomPipeHeight = PLAYABLE_HEIGHT - bottomPipeY;

    drawSinglePipe(ctx, pipe.x, 0, PIPE_WIDTH, topPipeHeight, true);
    drawSinglePipe(ctx, pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight, false);
  }
}

function drawGround(ctx: CanvasRenderingContext2D, groundOffset: number) {
  const y = PLAYABLE_HEIGHT;

  // Top grass turf strip
  ctx.fillStyle = '#22C55E';
  ctx.fillRect(0, y, CANVAS_WIDTH, 18);

  // Bright top grass highlight
  ctx.fillStyle = '#86EFAC';
  ctx.fillRect(0, y, CANVAS_WIDTH, 4);

  // Diagonal grass chevron stripes for clear sense of speed
  const stripeW = 28;
  const offset = groundOffset % stripeW;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y + 4, CANVAS_WIDTH, 14);
  ctx.clip();

  ctx.fillStyle = '#16A34A';
  for (let sx = -stripeW - offset; sx < CANVAS_WIDTH + stripeW; sx += stripeW) {
    ctx.beginPath();
    ctx.moveTo(sx, y + 18);
    ctx.lineTo(sx + 10, y + 4);
    ctx.lineTo(sx + 20, y + 4);
    ctx.lineTo(sx + 10, y + 18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Grass-to-earth border
  ctx.fillStyle = '#14532D';
  ctx.fillRect(0, y + 18, CANVAS_WIDTH, 3);
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(0, y, CANVAS_WIDTH, 2);

  // Warm sandy earth base
  const earthGrad = ctx.createLinearGradient(0, y + 21, 0, CANVAS_HEIGHT);
  earthGrad.addColorStop(0, '#E7C98F');
  earthGrad.addColorStop(1, '#CFA668');
  ctx.fillStyle = earthGrad;
  ctx.fillRect(0, y + 21, CANVAS_WIDTH, GROUND_HEIGHT - 21);

  // Subtle scrolling pebbles in earth
  const pebbleTile = 96;
  const pOffset = groundOffset % pebbleTile;
  ctx.fillStyle = 'rgba(161, 114, 53, 0.35)';
  for (let px = -pebbleTile - pOffset; px < CANVAS_WIDTH + pebbleTile; px += pebbleTile) {
    drawRoundedRect(ctx, px + 14, y + 36, 18, 7, 3.5);
    ctx.fill();
    drawRoundedRect(ctx, px + 56, y + 58, 14, 6, 3);
    ctx.fill();
    drawRoundedRect(ctx, px + 34, y + 72, 22, 6, 3);
    ctx.fill();
  }
}

function drawBird(ctx: CanvasRenderingContext2D, bird: BirdState) {
  ctx.save();
  ctx.translate(BIRD_X, bird.y);
  ctx.rotate(bird.rotation);

  // Tail feathers
  ctx.fillStyle = '#EA580C';
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, -2);
  ctx.lineTo(-24, -8);
  ctx.lineTo(-20, 0);
  ctx.lineTo(-24, 6);
  ctx.lineTo(-13, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Main body
  const bodyGrad = ctx.createRadialGradient(-3, -5, 3, 0, 0, BIRD_RADIUS + 4);
  bodyGrad.addColorStop(0, '#FDE047'); // Bright yellow crown
  bodyGrad.addColorStop(0.55, '#FACC15'); // Warm gold
  bodyGrad.addColorStop(1, '#EA580C'); // Warm amber-orange edge

  ctx.beginPath();
  ctx.ellipse(0, 0, BIRD_RADIUS + 2, BIRD_RADIUS - 1, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Warm cream belly patch
  ctx.beginPath();
  ctx.ellipse(2, 6, 11, 7, -0.1, 0, Math.PI);
  ctx.fillStyle = 'rgba(254, 249, 195, 0.85)';
  ctx.fill();

  // Eye (white sclera + expressive pupil + catchlight)
  ctx.beginPath();
  ctx.arc(8, -5, 6.2, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(10, -5, 2.7, 0, Math.PI * 2);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(11, -6.2, 1.1, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // Two-part beak
  // Upper beak
  ctx.beginPath();
  ctx.moveTo(13, -2);
  ctx.quadraticCurveTo(25, -2, 26, 2.5);
  ctx.lineTo(13, 3.5);
  ctx.closePath();
  ctx.fillStyle = '#F97316';
  ctx.fill();
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Lower beak
  ctx.beginPath();
  ctx.moveTo(13, 3.5);
  ctx.lineTo(23, 3.5);
  ctx.quadraticCurveTo(21, 8, 13, 7);
  ctx.closePath();
  ctx.fillStyle = '#DC2626';
  ctx.fill();
  ctx.stroke();

  // Animated flapping wing
  const wingOffsetY = Math.sin(bird.wingPhase) * 4.5;
  const wingTilt = Math.sin(bird.wingPhase) * 0.35;
  ctx.save();
  ctx.translate(-4, 1 + wingOffsetY * 0.45);
  ctx.rotate(wingTilt);
  ctx.beginPath();
  ctx.ellipse(0, 0, 9.5, 6, -0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#FEF08A';
  ctx.fill();
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * alpha), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function renderGameFrame({
  ctx,
  bird,
  pipes,
  clouds,
  particles,
  groundOffset,
  cityOffset,
  score,
  flashAlpha,
  shakeX,
  shakeY,
}: RenderFrameParams) {
  ctx.save();
  if (shakeX !== 0 || shakeY !== 0) {
    ctx.translate(shakeX, shakeY);
  }

  drawSky(ctx, score);

  for (const cloud of clouds) {
    drawCloud(ctx, cloud);
  }

  drawDistantHorizon(ctx, cityOffset);
  drawPipes(ctx, pipes);
  drawParticles(ctx, particles);
  drawGround(ctx, groundOffset);
  drawBird(ctx, bird);

  ctx.restore();

  if (flashAlpha > 0.01) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
}
