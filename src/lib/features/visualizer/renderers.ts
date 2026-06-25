// Canvas renderers for the four visualizer types
// All functions are pure — they receive canvas context and data, draw, return nothing.

const GRADIENT_STOPS: [number, string][] = [
  [0, "#ff4444"],
  [0.2, "#ff8800"],
  [0.4, "#ffcc00"],
  [0.6, "#00cc66"],
  [0.8, "#00aaff"],
  [1, "#aa44ff"],
];

export function createWarmToCoolGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, width, 0);
  for (const [offset, color] of GRADIENT_STOPS) {
    g.addColorStop(offset, color);
  }
  return g;
}

function createVerticalGradient(
  ctx: CanvasRenderingContext2D,
  height: number,
): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  for (const [offset, color] of GRADIENT_STOPS) {
    g.addColorStop(offset, color);
  }
  return g;
}

// Bars — 64 frequency bars growing upward from the bottom
export function drawBars(
  ctx: CanvasRenderingContext2D,
  freqData: Uint8Array,
  w: number,
  h: number,
): void {
  ctx.clearRect(0, 0, w, h);

  const barCount = 64;
  const gap = 2;
  const totalGap = gap * (barCount - 1);
  const barWidth = (w - totalGap) / barCount;
  const binStep = Math.floor(freqData.length / barCount);
  const gradient = createWarmToCoolGradient(ctx, w);

  for (let i = 0; i < barCount; i++) {
    const value = freqData[i * binStep] ?? 0;
    const barHeight = (value / 255) * h;
    if (barHeight < 1) continue;

    const x = i * (barWidth + gap);
    const y = h - barHeight;
    const radius = Math.min(barWidth / 2, 3);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
    ctx.lineTo(x + barWidth, h);
    ctx.closePath();
    ctx.fill();
  }
}

// Spectrum — smooth bezier curve with gradient fill beneath
export function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  freqData: Uint8Array,
  w: number,
  h: number,
): void {
  ctx.clearRect(0, 0, w, h);

  const points = 64;
  const binStep = Math.floor(freqData.length / points);
  const gradient = createWarmToCoolGradient(ctx, w);
  const verticalGradient = createVerticalGradient(ctx, h);

  const coords: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const value = freqData[i * binStep] ?? 0;
    const x = (i / (points - 1)) * w;
    const y = h - (value / 255) * h * 0.9;
    coords.push([x, y]);
  }

  // Fill beneath the curve
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < coords.length; i++) {
    const [x, y] = coords[i];
    if (i === 0) {
      ctx.lineTo(x, y);
    } else {
      const [px, py] = coords[i - 1];
      const cpx = (px + x) / 2;
      ctx.bezierCurveTo(cpx, py, cpx, y, x, y);
    }
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = verticalGradient;
  ctx.globalAlpha = 0.4;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Stroke the curve
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < coords.length; i++) {
    const [x, y] = coords[i];
    if (i === 0) {
      ctx.lineTo(x, y);
    } else {
      const [px, py] = coords[i - 1];
      const cpx = (px + x) / 2;
      ctx.bezierCurveTo(cpx, py, cpx, y, x, y);
    }
  }
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Scope — raw waveform as a continuous line
export function drawScope(
  ctx: CanvasRenderingContext2D,
  timeData: Uint8Array,
  w: number,
  h: number,
): void {
  ctx.clearRect(0, 0, w, h);

  // Center reference line
  ctx.strokeStyle = "rgba(0, 204, 102, 0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  // Waveform
  ctx.strokeStyle = "#00cc66";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < timeData.length; i++) {
    const x = (i / (timeData.length - 1)) * w;
    const y = (timeData[i] / 255) * h;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

// Particles — 60 frequency-driven particles drifting upward
export interface Particle {
  x: number;
  y: number;
  baseX: number;
  size: number;
  speed: number;
  opacity: number;
  color: string;
  frequencyBin: number;
  sineOffset: number;
  sineSpeed: number;
}

function colorForBin(bin: number, totalBins: number): string {
  const t = bin / totalBins;
  const stops = GRADIENT_STOPS;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const local = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return lerpColor(stops[i - 1][1], stops[i][1], local);
    }
  }
  return stops[stops.length - 1][1];
}

function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

export function createParticles(count: number, binCount: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const bin = Math.floor((i / count) * binCount);
    return {
      x: Math.random(),
      y: Math.random(),
      baseX: Math.random(),
      size: 2 + Math.random() * 3,
      speed: 0.002 + Math.random() * 0.003,
      opacity: 0.6 + Math.random() * 0.4,
      color: colorForBin(bin, binCount),
      frequencyBin: bin,
      sineOffset: Math.random() * Math.PI * 2,
      sineSpeed: 0.5 + Math.random() * 1.5,
    };
  });
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  freqData: Uint8Array,
  w: number,
  h: number,
  particles: Particle[],
  time: number,
): void {
  ctx.clearRect(0, 0, w, h);

  for (const p of particles) {
    const value = freqData[p.frequencyBin] ?? 0;
    const intensity = value / 255;

    // Size driven by frequency
    const renderSize = p.size * (0.5 + intensity * 1.5);

    // Speed driven by frequency
    const speed = p.speed * (0.3 + intensity * 2);

    // Update position
    p.y -= speed;
    if (p.y < -0.05) {
      p.y = 1.05;
      p.baseX = Math.random();
    }

    // Horizontal drift via sine
    const drift = Math.sin(time * p.sineSpeed + p.sineOffset) * 0.03;
    p.x = p.baseX + drift;

    // Opacity: quiet bins fade to 0.1
    const alpha = value < 30 ? 0.1 : 0.1 + intensity * 0.9;

    const cx = p.x * w;
    const cy = p.y * h;

    ctx.globalAlpha = alpha * p.opacity;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(cx, cy, renderSize, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
