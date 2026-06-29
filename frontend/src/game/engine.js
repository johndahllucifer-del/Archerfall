// Pure game engine logic (no React). Mutates a shared "state" object.
import { sounds } from "./sounds";

export const GRAVITY = 0.32;
export const BOW_X = 90;
export const ARROW_LENGTH = 44;
export const MAX_POWER = 22;
export const MIN_POWER = 7;

export const createInitialState = (width, height) => ({
  width,
  height,
  bow: { x: BOW_X, y: height / 2 },
  mouse: { x: width / 2, y: height / 2 },
  charging: false,
  chargeStart: 0,
  power: 0,
  arrows: [],
  targets: [],
  particles: [],
  drops: [], // power-up drops
  floatTexts: [], // "+10" floating texts
  score: 0,
  level: 1,
  lives: 3,
  targetsHit: 0,
  targetsForLevel: 10,
  spawnTimer: 0,
  spawnInterval: 1400,
  activePowerUp: null, // { type, expiresAt, ammo }
  slowmoFactor: 1,
  status: "menu", // menu | playing | paused | gameOver | levelComplete
  lastSpawnTime: performance.now(),
});

export const resetForNewGame = (state) => {
  state.score = 0;
  state.level = 1;
  state.lives = 3;
  state.targetsHit = 0;
  state.targetsForLevel = 10;
  state.spawnInterval = 1400;
  state.arrows = [];
  state.targets = [];
  state.particles = [];
  state.drops = [];
  state.floatTexts = [];
  state.activePowerUp = null;
  state.slowmoFactor = 1;
  state.status = "playing";
  state.lastSpawnTime = performance.now();
};

export const updateBowAngle = (state) => {
  const dx = state.mouse.x - state.bow.x;
  const dy = state.mouse.y - state.bow.y;
  state.bow.angle = Math.atan2(dy, dx);
};

export const startCharge = (state) => {
  if (state.status !== "playing") return;
  state.charging = true;
  state.chargeStart = performance.now();
  sounds.bowDraw();
};

export const releaseShot = (state) => {
  if (state.status !== "playing" || !state.charging) return;
  const heldMs = performance.now() - state.chargeStart;
  const t = Math.min(1, heldMs / 900);
  const power = MIN_POWER + (MAX_POWER - MIN_POWER) * t;
  state.charging = false;
  state.power = power;

  const angle = state.bow.angle;
  const isTriple = state.activePowerUp?.type === "triple" && state.activePowerUp.ammo > 0;
  const isExplosive = state.activePowerUp?.type === "explosive" && state.activePowerUp.ammo > 0;

  const spreads = isTriple ? [-0.18, 0, 0.18] : [0];
  spreads.forEach((spread) => {
    state.arrows.push({
      x: state.bow.x + Math.cos(angle + spread) * 30,
      y: state.bow.y + Math.sin(angle + spread) * 30,
      vx: Math.cos(angle + spread) * power,
      vy: Math.sin(angle + spread) * power,
      rotation: angle + spread,
      alive: true,
      explosive: isExplosive,
      trail: [],
    });
  });

  if (isTriple || isExplosive) {
    state.activePowerUp.ammo -= 1;
    if (state.activePowerUp.ammo <= 0) state.activePowerUp = null;
  }
  sounds.arrowShoot();
};

const spawnTarget = (state) => {
  const lvl = state.level;
  const roll = Math.random();
  // Higher levels get more variety
  let type;
  if (lvl >= 5 && roll < 0.15) type = "boss";
  else if (lvl >= 3 && roll < 0.3) type = "flyer";
  else if (roll < 0.55) type = "bullseye";
  else type = "balloon";

  const baseSpeed = 1.3 + lvl * 0.22 + Math.random() * 0.7;
  const y = 90 + Math.random() * (state.height - 220);

  if (type === "balloon") {
    state.targets.push({
      type, x: state.width + 30, y,
      r: 26 + Math.random() * 6,
      vx: -baseSpeed * 0.85,
      vy: -0.4 - Math.random() * 0.3,
      sway: { amp: 8 + Math.random() * 8, freq: 0.002 + Math.random() * 0.002, t: 0 },
      hp: 1, points: 10, color: ["#f97316", "#ec4899", "#22d3ee", "#a3e635", "#fbbf24"][Math.floor(Math.random() * 5)],
      alive: true,
    });
  } else if (type === "bullseye") {
    state.targets.push({
      type, x: state.width + 30, y,
      r: 30, vx: -baseSpeed, vy: 0,
      bob: { amp: 18, freq: 0.003, t: Math.random() * 1000 },
      hp: 1, points: 25, alive: true,
    });
  } else if (type === "flyer") {
    state.targets.push({
      type, x: state.width + 40, y,
      r: 22, vx: -baseSpeed * 1.25, vy: 0,
      zig: { amp: 60, freq: 0.004, t: Math.random() * 1000 },
      hp: 1, points: 40, alive: true,
    });
  } else if (type === "boss") {
    state.targets.push({
      type, x: state.width + 50, y: Math.max(120, y),
      r: 44, vx: -baseSpeed * 0.7, vy: 0,
      bob: { amp: 28, freq: 0.002, t: Math.random() * 1000 },
      hp: 3, maxHp: 3, points: 100, alive: true,
    });
  }
};

const spawnParticles = (state, x, y, color, count = 14, big = false) => {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = (big ? 4 : 2) + Math.random() * (big ? 6 : 3);
    state.particles.push({
      x, y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 1,
      r: 2 + Math.random() * (big ? 5 : 3),
      color,
      life: 1,
      decay: 0.02 + Math.random() * 0.02,
    });
  }
};

const spawnFloatText = (state, x, y, text, color = "#fbbf24") => {
  state.floatTexts.push({ x, y, text, color, life: 1, vy: -1.2 });
};

const maybeDropPowerUp = (state, x, y, target) => {
  // Higher chance for harder targets
  let chance = 0;
  if (target.type === "balloon") chance = 0.06;
  else if (target.type === "bullseye") chance = 0.1;
  else if (target.type === "flyer") chance = 0.18;
  else if (target.type === "boss") chance = 0.7;
  if (Math.random() < chance) {
    const kinds = ["triple", "slowmo", "explosive"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    state.drops.push({
      x, y, vy: 0.4, kind, alive: true, t: 0,
    });
  }
};

const activatePowerUp = (state, kind) => {
  sounds.powerUp();
  if (kind === "triple") {
    state.activePowerUp = { type: "triple", ammo: 5 };
  } else if (kind === "explosive") {
    state.activePowerUp = { type: "explosive", ammo: 3 };
  } else if (kind === "slowmo") {
    state.activePowerUp = { type: "slowmo", expiresAt: performance.now() + 5000 };
  }
};

const explodeAt = (state, x, y) => {
  sounds.explosion();
  spawnParticles(state, x, y, "#fb923c", 40, true);
  const radius = 95;
  state.targets.forEach((t) => {
    if (!t.alive) return;
    const dx = t.x - x, dy = t.y - y;
    if (dx * dx + dy * dy < (radius + t.r) ** 2) {
      damageTarget(state, t, 3);
    }
  });
};

const damageTarget = (state, target, dmg = 1) => {
  target.hp -= dmg;
  if (target.hp <= 0) {
    target.alive = false;
    state.score += target.points;
    state.targetsHit += 1;
    spawnFloatText(state, target.x, target.y, `+${target.points}`);
    spawnParticles(state, target.x, target.y, target.color || "#fbbf24", target.type === "boss" ? 28 : 16, target.type === "boss");
    if (target.type === "balloon") sounds.pop();
    else sounds.hit();
    maybeDropPowerUp(state, target.x, target.y, target);
  } else {
    sounds.hit();
    spawnParticles(state, target.x, target.y, "#fff", 6);
  }
};

const checkLevelUp = (state) => {
  if (state.targetsHit >= state.targetsForLevel) {
    state.level += 1;
    state.targetsHit = 0;
    state.targetsForLevel = 10 + state.level * 2;
    state.spawnInterval = Math.max(450, 1400 - state.level * 90);
    state.status = "levelComplete";
    sounds.levelUp();
  }
};

export const updatePhysics = (state, dt) => {
  if (state.status !== "playing") return;
  const slow = state.activePowerUp?.type === "slowmo" ? 0.35 : 1;
  state.slowmoFactor = slow;

  if (state.activePowerUp?.type === "slowmo" && performance.now() > state.activePowerUp.expiresAt) {
    state.activePowerUp = null;
  }

  // Spawn targets
  state.spawnTimer += dt;
  if (state.spawnTimer > state.spawnInterval) {
    spawnTarget(state);
    state.spawnTimer = 0;
  }

  // Arrows
  for (const a of state.arrows) {
    if (!a.alive) continue;
    a.trail.push({ x: a.x, y: a.y });
    if (a.trail.length > 8) a.trail.shift();
    a.vy += GRAVITY * slow;
    a.x += a.vx * slow;
    a.y += a.vy * slow;
    a.rotation = Math.atan2(a.vy, a.vx);
    if (a.x < -50 || a.x > state.width + 50 || a.y > state.height + 50) {
      a.alive = false;
    }
    // collisions with targets
    for (const t of state.targets) {
      if (!t.alive) continue;
      const dx = a.x - t.x, dy = a.y - t.y;
      if (dx * dx + dy * dy < (t.r + 4) ** 2) {
        if (a.explosive) {
          explodeAt(state, a.x, a.y);
        } else {
          damageTarget(state, t, 1);
        }
        a.alive = false;
        break;
      }
    }
  }
  state.arrows = state.arrows.filter((a) => a.alive);

  // Targets
  for (const t of state.targets) {
    if (!t.alive) continue;
    t.x += t.vx * slow;
    if (t.type === "balloon") {
      t.sway.t += dt * slow;
      t.y += t.vy * slow + Math.sin(t.sway.t * t.sway.freq) * 0.5;
    } else if (t.type === "bullseye") {
      t.bob.t += dt * slow;
      t.y += Math.sin(t.bob.t * t.bob.freq) * 0.8;
    } else if (t.type === "flyer") {
      t.zig.t += dt * slow;
      t.y += Math.sin(t.zig.t * t.zig.freq) * 1.4;
    } else if (t.type === "boss") {
      t.bob.t += dt * slow;
      t.y += Math.sin(t.bob.t * t.bob.freq) * 0.6;
    }
    // Missed target - reached the bow side
    if (t.x < -40) {
      t.alive = false;
      // Bosses & flyers cost a life if they escape
      if (t.type === "boss" || t.type === "flyer") {
        state.lives -= 1;
        sounds.miss();
        spawnFloatText(state, 60, state.height - 40, "-1 LIFE", "#ef4444");
        if (state.lives <= 0) {
          state.status = "gameOver";
          sounds.gameOver();
        }
      }
    }
  }
  state.targets = state.targets.filter((t) => t.alive);

  // Drops
  for (const d of state.drops) {
    if (!d.alive) continue;
    d.t += dt * slow;
    d.y += d.vy * slow;
    d.x -= 0.4 * slow;
    if (d.y > state.height - 80) d.vy = -d.vy * 0.5;
    if (d.x < -40 || d.t > 8000) d.alive = false;
    // Check arrow collision
    for (const a of state.arrows) {
      if (!a.alive) continue;
      const dx = a.x - d.x, dy = a.y - d.y;
      if (dx * dx + dy * dy < 26 * 26) {
        activatePowerUp(state, d.kind);
        d.alive = false;
        a.alive = false;
        break;
      }
    }
  }
  state.drops = state.drops.filter((d) => d.alive);

  // Particles
  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= p.decay;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  // Float texts
  for (const f of state.floatTexts) {
    f.y += f.vy;
    f.life -= 0.018;
  }
  state.floatTexts = state.floatTexts.filter((f) => f.life > 0);

  checkLevelUp(state);
};
