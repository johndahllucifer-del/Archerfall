// Canvas rendering. Pure draw functions reading from state.
import { getEffectiveChargeMs } from "./engine";
import { BOWS } from "./shop";

const drawCloud = () => {};
const drawHill = () => {};

export const drawBackground = (ctx, state, time) => {
  const { width, height, theme = "day" } = state;
  if (theme === "night") return drawNightBackground(ctx, state, time);
  if (theme === "sunset") return drawSunsetBackground(ctx, state, time);
  return drawDayBackground(ctx, state, time);
};

const drawDayBackground = (ctx, state, time) => {
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

  drawClouds(ctx, width, height, time, "rgba(255,255,255,0.85)");
  drawHills(ctx, width, height, "#bfddc3", "#a8d4ae");
  drawGround(ctx, width, height, "#86c596", "#6fb480", "#5ea36f");
};

const drawSunsetBackground = (ctx, state, time) => {
  const { width, height } = state;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#2a1b3d");
  sky.addColorStop(0.4, "#c44569");
  sky.addColorStop(0.7, "#f8b500");
  sky.addColorStop(1, "#ff7e5f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Sun setting low
  ctx.save();
  const sunX = width * 0.75, sunY = height - 130;
  const grad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 180);
  grad.addColorStop(0, "rgba(255,150,80,1)");
  grad.addColorStop(0.4, "rgba(255,120,60,0.5)");
  grad.addColorStop(1, "rgba(255,120,60,0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(sunX, sunY, 180, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff6b35";
  ctx.beginPath(); ctx.arc(sunX, sunY, 50, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  drawClouds(ctx, width, height, time, "rgba(255,180,140,0.7)");
  drawHills(ctx, width, height, "#4a2c4f", "#3a1f3d");
  drawGround(ctx, width, height, "#2d1b3d", "#1f0f2a", "#1a0a24");
};

const drawNightBackground = (ctx, state, time) => {
  const { width, height } = state;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#0a0e2a");
  sky.addColorStop(0.5, "#1a1a4a");
  sky.addColorStop(1, "#2d2a5a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Stars (deterministic based on time so they twinkle but stay put)
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 50; i++) {
    const sx = (i * 137.5) % width;
    const sy = ((i * 79.3) % (height - 200));
    const tw = (Math.sin(time * 0.002 + i) + 1) * 0.5;
    ctx.globalAlpha = 0.4 + tw * 0.6;
    const r = 0.8 + (i % 3) * 0.4;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Moon
  ctx.save();
  const mx = width - 150, my = 120;
  const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 90);
  mg.addColorStop(0, "rgba(220,220,255,0.6)");
  mg.addColorStop(1, "rgba(220,220,255,0)");
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.arc(mx, my, 90, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e8e8ff";
  ctx.beginPath(); ctx.arc(mx, my, 36, 0, Math.PI * 2); ctx.fill();
  // Moon craters
  ctx.fillStyle = "rgba(160,160,200,0.5)";
  ctx.beginPath(); ctx.arc(mx - 10, my - 6, 6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 8, my + 10, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 12, my - 12, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  drawClouds(ctx, width, height, time, "rgba(80,80,140,0.5)");
  drawHills(ctx, width, height, "#1a2040", "#10162e");
  drawGround(ctx, width, height, "#1a2545", "#0f1830", "#243056");

  // Fireflies
  for (let i = 0; i < 8; i++) {
    const fx = ((i * 200 + time * 0.04) % (width + 40)) - 20;
    const fy = height - 90 - Math.sin(time * 0.003 + i) * 30;
    ctx.fillStyle = "rgba(190,255,120,0.8)";
    ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(190,255,120,0.2)";
    ctx.beginPath(); ctx.arc(fx, fy, 6, 0, Math.PI * 2); ctx.fill();
  }
};

const drawClouds = (ctx, width, height, time, color) => {
  ctx.save();
  const t = time * 0.00003;
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 280 - t * 4000) % (width + 200) + width + 200) % (width + 200) - 100;
    ctx.fillStyle = color;
    const scale = 0.8 + (i % 2) * 0.3;
    const y = 70 + i * 24;
    ctx.beginPath();
    ctx.arc(cx, y, 18 * scale, 0, Math.PI * 2);
    ctx.arc(cx + 18 * scale, y + 4 * scale, 22 * scale, 0, Math.PI * 2);
    ctx.arc(cx + 38 * scale, y, 16 * scale, 0, Math.PI * 2);
    ctx.arc(cx + 20 * scale, y - 10 * scale, 18 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawHills = (ctx, width, height, color1, color2) => {
  ctx.fillStyle = color1;
  ctx.beginPath();
  ctx.ellipse(width * 0.2, height - 60, width * 0.3, 80, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color2;
  ctx.beginPath();
  ctx.ellipse(width * 0.65, height - 50, width * 0.32, 70, 0, 0, Math.PI * 2);
  ctx.fill();
};

const drawGround = (ctx, width, height, base, strip, grass) => {
  ctx.fillStyle = base;
  ctx.fillRect(0, height - 70, width, 70);
  ctx.fillStyle = strip;
  ctx.fillRect(0, height - 70, width, 6);
  ctx.strokeStyle = grass;
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
  const equippedBow = BOWS[state.equippedBow] || BOWS.wooden;
  const isNight = state.theme === "night";
  ctx.save();
  ctx.translate(bow.x, bow.y);
  ctx.rotate(bow.angle);

  // Glow for premium bows
  if (equippedBow.id !== "wooden") {
    ctx.save();
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 48);
    g.addColorStop(0, equippedBow.color + "80");
    g.addColorStop(1, equippedBow.color + "00");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Bow body
  ctx.strokeStyle = equippedBow.color;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 32, -Math.PI / 2.2, Math.PI / 2.2);
  ctx.stroke();

  // Bow grip
  ctx.fillStyle = equippedBow.accent;
  ctx.fillRect(-4, -10, 8, 20);

  // String
  const chargeDur = getEffectiveChargeMs(state);
  const chargePull = charging ? Math.min(1, (performance.now() - state.chargeStart) / chargeDur) : 0;
  ctx.strokeStyle = isNight ? "#cbd5e1" : "#fff";
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
    const t = Math.min(1, (performance.now() - state.chargeStart) / chargeDur);
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
  ctx.strokeStyle = isNight ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)";
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
  // Enemy projectiles (boss fireballs)
  for (const p of state.enemyProjectiles || []) {
    const flicker = Math.sin(time * 0.02 + p.t * 0.01) * 2;
    const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r + 8 + flicker);
    g.addColorStop(0, "#fde68a");
    g.addColorStop(0.5, "#f97316");
    g.addColorStop(1, "rgba(239,68,68,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 8 + flicker, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  drawParticles(ctx, state);
  drawBow(ctx, state);
  drawFloatTexts(ctx, state);

  // Combo badge in top-center while active
  if (state.combo >= 3) {
    const mult = state.combo >= 12 ? 5 : state.combo >= 8 ? 3 : state.combo >= 5 ? 2 : 1.5;
    ctx.save();
    ctx.font = "bold 28px 'Bricolage Grotesque', sans-serif";
    ctx.textAlign = "center";
    const color = mult >= 3 ? "#ef4444" : "#fb923c";
    ctx.fillStyle = color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    const text = `×${mult}  ·  ${state.combo} STREAK`;
    ctx.strokeText(text, state.width / 2, 50);
    ctx.fillText(text, state.width / 2, 50);
    ctx.restore();
  }
};
