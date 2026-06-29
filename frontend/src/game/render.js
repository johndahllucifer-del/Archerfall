// Canvas rendering. Pure draw functions reading from state.
import { BOW_X, MIN_POWER, MAX_POWER } from "./engine";

const drawCloud = (ctx, x, y, scale = 1) => {
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(x, y, 18 * scale, 0, Math.PI * 2);
  ctx.arc(x + 18 * scale, y + 4 * scale, 22 * scale, 0, Math.PI * 2);
  ctx.arc(x + 38 * scale, y, 16 * scale, 0, Math.PI * 2);
  ctx.arc(x + 20 * scale, y - 10 * scale, 18 * scale, 0, Math.PI * 2);
  ctx.fill();
};

const drawHill = (ctx, x, y, w, h, color) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
};

export const drawBackground = (ctx, state, time) => {
  const { width, height } = state;
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#ffe6b3");
  sky.addColorStop(0.5, "#ffcce0");
  sky.addColorStop(1, "#c8e7ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Sun
  ctx.save();
  ctx.globalAlpha = 0.85;
  const sunX = width - 140, sunY = 110;
  const grad = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 120);
  grad.addColorStop(0, "rgba(255,235,150,1)");
  grad.addColorStop(0.5, "rgba(255,200,120,0.4)");
  grad.addColorStop(1, "rgba(255,200,120,0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(sunX, sunY, 120, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fde68a";
  ctx.beginPath(); ctx.arc(sunX, sunY, 38, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Clouds (parallax)
  const t = time * 0.00003;
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 280 - t * 4000) % (width + 200) + width + 200) % (width + 200) - 100;
    drawCloud(ctx, cx, 70 + i * 24, 0.8 + (i % 2) * 0.3);
  }

  // Distant hills
  drawHill(ctx, width * 0.2, height - 60, width * 0.3, 80, "#bfddc3");
  drawHill(ctx, width * 0.65, height - 50, width * 0.32, 70, "#a8d4ae");

  // Ground
  ctx.fillStyle = "#86c596";
  ctx.fillRect(0, height - 70, width, 70);
  // Grass strip
  ctx.fillStyle = "#6fb480";
  ctx.fillRect(0, height - 70, width, 6);

  // Grass blades
  ctx.strokeStyle = "#5ea36f";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < width; i += 14) {
    const gx = i;
    const gy = height - 66;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 3, gy - 8);
    ctx.moveTo(gx + 5, gy);
    ctx.lineTo(gx + 8, gy - 6);
    ctx.stroke();
  }
};

export const drawBow = (ctx, state) => {
  const { bow, charging } = state;
  ctx.save();
  ctx.translate(bow.x, bow.y);
  ctx.rotate(bow.angle);

  // Bow body
  ctx.strokeStyle = "#7a4a2a";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 32, -Math.PI / 2.2, Math.PI / 2.2);
  ctx.stroke();

  // Bow grip
  ctx.fillStyle = "#3a2418";
  ctx.fillRect(-4, -10, 8, 20);

  // String
  const chargePull = charging ? Math.min(1, (performance.now() - state.chargeStart) / 900) : 0;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(-12 * chargePull, 0);
  ctx.lineTo(0, 28);
  ctx.stroke();

  // Nocked arrow when charging
  if (charging) {
    const pull = chargePull;
    ctx.fillStyle = "#d4a373";
    ctx.fillRect(-10 - pull * 18, -1.5, 40, 3);
    ctx.fillStyle = "#e63946";
    ctx.beginPath();
    ctx.moveTo(30 - pull * 18, -1.5);
    ctx.lineTo(38 - pull * 18, 0);
    ctx.lineTo(30 - pull * 18, 1.5);
    ctx.fill();
    // Fletching
    ctx.fillStyle = "#f72585";
    ctx.beginPath();
    ctx.moveTo(-10 - pull * 18, -1.5);
    ctx.lineTo(-18 - pull * 18, -5);
    ctx.lineTo(-14 - pull * 18, 0);
    ctx.lineTo(-18 - pull * 18, 5);
    ctx.lineTo(-10 - pull * 18, 1.5);
    ctx.fill();
  }
  ctx.restore();

  // Power meter when charging
  if (charging) {
    const t = Math.min(1, (performance.now() - state.chargeStart) / 900);
    const meterW = 90, meterH = 8;
    const mx = bow.x - meterW / 2, my = bow.y + 60;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(mx, my, meterW, meterH);
    const color = t < 0.4 ? "#fbbf24" : t < 0.8 ? "#fb923c" : "#ef4444";
    ctx.fillStyle = color;
    ctx.fillRect(mx, my, meterW * t, meterH);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.strokeRect(mx, my, meterW, meterH);
  }

  // Aim line (dotted)
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bow.x, bow.y);
  ctx.lineTo(state.mouse.x, state.mouse.y);
  ctx.stroke();
  ctx.restore();
};

const drawArrow = (ctx, a) => {
  // Trail
  for (let i = 0; i < a.trail.length; i++) {
    const p = a.trail[i];
    const alpha = (i / a.trail.length) * 0.4;
    ctx.fillStyle = `rgba(212,163,115,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rotation);
  // Shaft
  ctx.fillStyle = a.explosive ? "#ef4444" : "#d4a373";
  ctx.fillRect(-22, -1.5, 44, 3);
  // Tip
  ctx.fillStyle = a.explosive ? "#fbbf24" : "#3a2418";
  ctx.beginPath();
  ctx.moveTo(22, -2);
  ctx.lineTo(30, 0);
  ctx.lineTo(22, 2);
  ctx.closePath();
  ctx.fill();
  // Fletching
  ctx.fillStyle = a.explosive ? "#fbbf24" : "#f72585";
  ctx.beginPath();
  ctx.moveTo(-22, -1.5);
  ctx.lineTo(-30, -5);
  ctx.lineTo(-26, 0);
  ctx.lineTo(-30, 5);
  ctx.lineTo(-22, 1.5);
  ctx.fill();
  ctx.restore();
};

const drawTarget = (ctx, t, time) => {
  ctx.save();
  if (t.type === "balloon") {
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, t.r * 0.9, t.r, 0, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.ellipse(t.x - t.r * 0.3, t.y - t.r * 0.4, t.r * 0.2, t.r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Knot
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.moveTo(t.x - 4, t.y + t.r);
    ctx.lineTo(t.x + 4, t.y + t.r);
    ctx.lineTo(t.x, t.y + t.r + 6);
    ctx.closePath();
    ctx.fill();
    // String
    ctx.strokeStyle = "rgba(60,60,60,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y + t.r + 6);
    ctx.quadraticCurveTo(t.x + 6, t.y + t.r + 20, t.x - 2, t.y + t.r + 36);
    ctx.stroke();
  } else if (t.type === "bullseye") {
    const colors = ["#1e293b", "#fff", "#ef4444", "#fff", "#fbbf24"];
    const rings = [1, 0.78, 0.58, 0.38, 0.2];
    rings.forEach((rr, i) => {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * rr, 0, Math.PI * 2);
      ctx.fill();
    });
    // Stand
    ctx.strokeStyle = "#7a4a2a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y + t.r);
    ctx.lineTo(t.x, t.y + t.r + 18);
    ctx.stroke();
  } else if (t.type === "flyer") {
    // Body
    ctx.fillStyle = "#6366f1";
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings (animated)
    const wf = Math.sin(time * 0.02) * 0.5;
    ctx.fillStyle = "#a5b4fc";
    ctx.beginPath();
    ctx.ellipse(t.x - 4, t.y - t.r * 0.7, t.r * 0.7, t.r * (0.4 + wf * 0.2), -0.3, 0, Math.PI * 2);
    ctx.ellipse(t.x + 4, t.y - t.r * 0.7, t.r * 0.7, t.r * (0.4 + wf * 0.2), 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Eye
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(t.x - 6, t.y - 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(t.x - 6, t.y - 2, 2, 0, Math.PI * 2); ctx.fill();
  } else if (t.type === "boss") {
    // Boss balloon
    ctx.fillStyle = "#7c3aed";
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, t.r * 0.95, t.r, 0, 0, Math.PI * 2);
    ctx.fill();
    // Spikes
    ctx.fillStyle = "#4c1d95";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(t.x + Math.cos(a) * t.r, t.y + Math.sin(a) * t.r);
      ctx.lineTo(t.x + Math.cos(a) * (t.r + 10), t.y + Math.sin(a) * (t.r + 10));
      ctx.lineTo(t.x + Math.cos(a + 0.15) * t.r, t.y + Math.sin(a + 0.15) * t.r);
      ctx.closePath();
      ctx.fill();
    }
    // Face
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(t.x - 12, t.y - 6, 6, 0, Math.PI * 2);
    ctx.arc(t.x + 12, t.y - 6, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(t.x - 12, t.y - 6, 3, 0, Math.PI * 2);
    ctx.arc(t.x + 12, t.y - 6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#1e1b4b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y + 10, 10, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // HP bar
    const bw = 60, bh = 6;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(t.x - bw / 2, t.y - t.r - 20, bw, bh);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(t.x - bw / 2, t.y - t.r - 20, bw * (t.hp / t.maxHp), bh);
  }
  ctx.restore();
};

const drawDrop = (ctx, d, time) => {
  const wobble = Math.sin(d.t * 0.005) * 4;
  const color = d.kind === "triple" ? "#22d3ee" : d.kind === "slowmo" ? "#a78bfa" : "#ef4444";
  ctx.save();
  ctx.translate(d.x, d.y + wobble);
  // Glow
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
  g.addColorStop(0, color + "aa");
  g.addColorStop(1, color + "00");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
  // Box
  ctx.fillStyle = color;
  ctx.fillRect(-14, -14, 28, 28);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(-14, -14, 28, 28);
  // Letter
  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const ch = d.kind === "triple" ? "3x" : d.kind === "slowmo" ? "⏱" : "★";
  ctx.fillText(ch, 0, 1);
  ctx.restore();
};

const drawParticles = (ctx, state) => {
  for (const p of state.particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

const drawFloatTexts = (ctx, state) => {
  ctx.font = "bold 20px 'Bricolage Grotesque', sans-serif";
  ctx.textAlign = "center";
  for (const f of state.floatTexts) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
};

export const drawScene = (ctx, state, time) => {
  drawBackground(ctx, state, time);

  // Slow-mo overlay
  if (state.activePowerUp?.type === "slowmo") {
    ctx.fillStyle = "rgba(167, 139, 250, 0.08)";
    ctx.fillRect(0, 0, state.width, state.height);
  }

  for (const t of state.targets) drawTarget(ctx, t, time);
  for (const d of state.drops) drawDrop(ctx, d, time);
  for (const a of state.arrows) drawArrow(ctx, a);
  drawParticles(ctx, state);
  drawBow(ctx, state);
  drawFloatTexts(ctx, state);
};
