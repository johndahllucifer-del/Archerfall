// Pure game engine logic (no React). Mutates a shared "state" object.
import { sounds } from "./sounds";
import { BOWS, ITEMS, loadProgress, saveProgress, getThemeForLevel } from "./shop";

export const GRAVITY = 0.12;
export const BOW_X = 90;
export const ARROW_LENGTH = 44;
export const MAX_POWER = 22;
export const MIN_POWER = 7;
export const BASE_CHARGE_MS = 900;

export const getEffectiveChargeMs = (state) =>
  state.ownedItems && state.ownedItems.includes("quickDraw") ? BASE_CHARGE_MS * 0.6 : BASE_CHARGE_MS;

export const createInitialState = (width, height) => {
  const prog = loadProgress();
  return {
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
    drops: [],
    floatTexts: [],
    score: 0,
    scoreAtLevelStart: 0,
    coinsEarnedThisLevel: 0,
    level: 1,
    lives: 3,
    targetsHit: 0,
    targetsForLevel: 10,
    spawnTimer: 0,
    spawnInterval: 1400,
    activePowerUp: null,
    slowmoFactor: 1,
    status: "menu",
    lastSpawnTime: performance.now(),
    theme: "day",
    // Combo / streak
    combo: 0,
    lastHitTime: 0,
    comboTimeoutMs: 2500,
    bestComboThisRun: 0,
    // Enemy projectiles (boss attacks)
    enemyProjectiles: [],
    // Shockwave rings (visual effect for explosions/big hits)
    shockwaves: [],
    // Screen shake amount (px), decays per frame
    shake: 0,
    // Tracks whether mega boss already spawned this level
    _megaBossSpawned: false,
    // Persistent progress (mirrored to localStorage)
    coins: prog.coins,
    ownedBows: prog.ownedBows,
    ownedItems: prog.ownedItems,
    equippedBow: prog.equippedBow,
    // Top-3 gate for Phoenix bow (set externally by frontend after leaderboard fetch)
    phoenixUnlocked: false,
  };
};

export const persistProgress = (state) => {
  saveProgress({
    coins: state.coins,
    ownedBows: state.ownedBows,
    ownedItems: state.ownedItems,
    equippedBow: state.equippedBow,
  });
};

export const equipBow = (state, bowId) => {
  if (bowId === "phoenix" && !state.phoenixUnlocked) return false;
  if (!state.ownedBows.includes(bowId) && bowId !== "phoenix") return false;
  state.equippedBow = bowId;
  persistProgress(state);
  return true;
};

export const buyBow = (state, bowId) => {
  const bow = BOWS[bowId];
  if (!bow || state.ownedBows.includes(bowId) || state.coins < bow.cost) return false;
  if (bow.gated) return false;
  state.coins -= bow.cost;
  state.ownedBows.push(bowId);
  state.equippedBow = bowId;
  persistProgress(state);
  return true;
};

export const buyItem = (state, itemId) => {
    const item = ITEMS[itemId];
    if (!item || state.coins < item.cost) return false;

    // Consumable itemler tekrar tekrar alınabilir
    if (item.consumable) {
        state.coins -= item.cost;
        state.ownedItems.push(itemId);
        persistProgress(state);
        return true;
    }

    // Normal itemler sadece 1 kez alınabilir
    if (state.ownedItems.includes(itemId)) return false;

    state.coins -= item.cost;
    state.ownedItems.push(itemId);

    persistProgress(state);
    return true;
};

export const resetForNewGame = (state) => {
  state.score = 0;
  state.scoreAtLevelStart = 0;
  state.coinsEarnedThisLevel = 0;
  state.level = 1;
  state.lives = state.ownedItems.includes("extraLife") ? 4 : 3;
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
  state.combo = 0;
  state.lastHitTime = 0;
  state.bestComboThisRun = 0;
  state.enemyProjectiles = [];
  state.shockwaves = [];
  state.shake = 0;
  state.chainUntil = 0;
  state.nextShotExplosive = false;
  state.lasers = [];
  state.pendingLaser = null;
  state._megaBossSpawned = false;
  state.status = "playing";
  state.theme = getThemeForLevel(1);
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
  const chargeDur = getEffectiveChargeMs(state);
  const t = Math.min(1, heldMs / chargeDur);
  let power = MIN_POWER + (MAX_POWER - MIN_POWER) * t;

  const bow = BOWS[state.equippedBow] || BOWS.wooden;
  let speedMult = bow.arrowSpeedMult;
  if (state.ownedItems.includes("eagleEye")) speedMult *= 1.25;
  power *= speedMult;

  state.charging = false;
  state.power = power;

  const angle = state.bow.angle;
  const isTriple = state.activePowerUp?.type === "triple" && state.activePowerUp.ammo > 0;
  const isExplosive =
    (state.activePowerUp?.type === "explosive" && state.activePowerUp.ammo > 0) ||
    bow.explosiveByDefault === true ||
    state.nextShotExplosive === true;

  // Determine arrow count: bow's intrinsic count, boosted by triple powerup
  let arrowCount = bow.arrowCount;
  if (isTriple) arrowCount = Math.max(3, arrowCount + 2);

  // Build evenly spaced spreads centered on angle
  const spreads = [];
  if (arrowCount === 1) spreads.push(0);
  else {
    const step = 0.16;
    const start = -((arrowCount - 1) / 2) * step;
    for (let i = 0; i < arrowCount; i++) spreads.push(start + i * step);
  }

  spreads.forEach((spread) => {
    state.arrows.push({
      x: state.bow.x + Math.cos(angle + spread) * 30,
      y: state.bow.y + Math.sin(angle + spread) * 30,
      vx: Math.cos(angle + spread) * power,
      vy: Math.sin(angle + spread) * power,
      rotation: angle + spread,
      alive: true,
      explosive: isExplosive,
      bowId: bow.id,
      trail: [],
    });
  });

  if (isTriple || (isExplosive && !bow.explosiveByDefault && !state.nextShotExplosive)) {
    if (state.activePowerUp) {
      state.activePowerUp.ammo -= 1;
      if (state.activePowerUp.ammo <= 0) state.activePowerUp = null;
    }
  }
  // Consume bomb-arrow flag after firing
  if (state.nextShotExplosive) state.nextShotExplosive = false;
  sounds.arrowShoot();
};

// === Consumable actions (called from UI) ===
export const activateBoltConsumable = (state, durationMs = 10000) => {
  state.chainUntil = performance.now() + durationMs;
};
export const activateBombArrowConsumable = (state) => {
  state.nextShotExplosive = true;
};
export const fireLaser = (state) => {
  if (state.status !== "playing") return;
  // Aim along the current bow direction
  const angle = state.bow.angle;
  const len = Math.hypot(state.width, state.height) * 1.2;
  const x2 = state.bow.x + Math.cos(angle) * len;
  const y2 = state.bow.y + Math.sin(angle) * len;
  state.lasers = state.lasers || [];
  state.lasers.push({ x1: state.bow.x, y1: state.bow.y, x2, y2, life: 1 });
  state.shake = Math.max(state.shake || 0, 22);
  sounds.explosion();
  // Damage anything within a wide corridor along the beam (8x wider than before)
  const beamHalfWidth = 224;
  const dirX = Math.cos(angle), dirY = Math.sin(angle);
  for (const t of state.targets) {
    if (!t.alive) continue;
    const vx = t.x - state.bow.x, vy = t.y - state.bow.y;
    const proj = vx * dirX + vy * dirY;
    if (proj < 0 || proj > len) continue;
    const perp = Math.abs(vx * -dirY + vy * dirX);
    if (perp > beamHalfWidth + t.r) continue;
    if (t.type === "boss" || t.type === "megaBoss" || t.type === "stormGiant") {
      const half = Math.ceil(t.hp / 2);
      damageTarget(state, t, half);
    } else {
      damageTarget(state, t, t.hp);
    }
  }
};

// Schedule a Red Laser shot 3s after clicking Use (with charging sound + visual ring)
export const beginLaserCharge = (state, chargeMs = 3000) => {
  if (state.status !== "playing") return false;
  if (state.pendingLaser) return false; // already charging
  state.pendingLaser = { fireAt: performance.now() + chargeMs, startedAt: performance.now(), durationMs: chargeMs };
  sounds.laserCharge && sounds.laserCharge();
  return true;
};

const spawnTarget = (state) => {
  const lvl = state.level;
  const roll = Math.random();
  // Higher levels get more variety
  let type;
  // Mega boss spawns at the start of every 10th level (and only one per level)
  if (lvl % 10 === 0 && !state._megaBossSpawned) {
    type = "megaBoss";
    state._megaBossSpawned = true;
  } else if (lvl >= 15 && roll < 0.06) type = "stormGiant";
  else if (lvl >= 5 && roll < 0.12) type = "zeppelin";
  else if (lvl >= 4 && roll < 0.20) type = "giantBalloon";
  else if (lvl >= 5 && roll < 0.28) type = "boss";
  else if (lvl >= 3 && roll < 0.40) type = "flyer";
  else if (roll < 0.62) type = "bullseye";
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
  } else if (type === "giantBalloon") {
    state.targets.push({
      type, x: state.width + 60, y: Math.max(150, y),
      r: 60, vx: -baseSpeed * 0.55,
      vy: -0.2,
      sway: { amp: 16, freq: 0.0015, t: Math.random() * 1000 },
      hp: 4, maxHp: 4, points: 150,
      color: ["#f43f5e", "#3b82f6", "#facc15", "#a855f7"][Math.floor(Math.random() * 4)],
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
      attackTimer: 1800 + Math.random() * 1500,
    });
  } else if (type === "zeppelin") {
    state.targets.push({
      type, x: state.width + 110, y: Math.max(140, Math.min(state.height - 280, y)),
      r: 80, vx: -baseSpeed * 0.45,
      vy: 0,
      bob: { amp: 10, freq: 0.0012, t: Math.random() * 1000 },
      hp: 6, maxHp: 6, points: 250, alive: true,
      propeller: 0,
    });
  } else if (type === "megaBoss") {
    state.targets.push({
      type, x: state.width + 130, y: Math.max(180, state.height / 2 - 50),
      r: 95, vx: -baseSpeed * 0.35,
      vy: 0,
      bob: { amp: 32, freq: 0.0015, t: 0 },
      hp: 15 + lvl, maxHp: 15 + lvl, points: 1000,
      alive: true,
      attackTimer: 1200,
      isMega: true,
    });
    spawnFloatText(state, state.width / 2, 80, `⚠ MEGA BOSS LV.${lvl}`, "#ef4444");
    state.shake = 12;
  } else if (type === "stormGiant") {
    const hp = 25 + lvl * 2;
    state.targets.push({
      type, x: state.width + 140, y: Math.max(200, state.height / 2 - 30),
      r: 110, vx: -baseSpeed * 0.4,
      vy: 0,
      bob: { amp: 40, freq: 0.0014, t: Math.random() * 1000 },
      hp, maxHp: hp, points: 1500, alive: true,
      attackTimer: 900, isStorm: true,
      lightning: 0,
    });
    spawnFloatText(state, state.width / 2, 80, `⛈ STORM GIANT`, "#7c3aed");
    state.shake = 16;
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
  if (state.ownedItems.includes("luckyCharm")) chance *= 1.7;
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
  state.shockwaves = state.shockwaves || [];
  state.shockwaves.push({ x, y, r: 8, maxR: 130, life: 1, color: "#fb923c" });
  state.shake = Math.max(state.shake || 0, 10);
  const radius = 95;
  state.targets.forEach((t) => {
    if (!t.alive) return;
    const dx = t.x - x, dy = t.y - y;
    if (dx * dx + dy * dy < (radius + t.r) ** 2) {
      damageTarget(state, t, 3);
    }
  });
};

const getComboMult = (combo) => {
  if (combo >= 12) return 5;
  if (combo >= 8) return 3;
  if (combo >= 5) return 2;
  if (combo >= 3) return 1.5;
  return 1;
};

const damageTarget = (state, target, dmg = 1) => {
  target.hp -= dmg;
  if (target.hp <= 0) {
    target.alive = false;
    const bow = BOWS[state.equippedBow] || BOWS.wooden;
    // Update combo
    const now = performance.now();
    if (state.lastHitTime && now - state.lastHitTime <= state.comboTimeoutMs) {
      state.combo += 1;
    } else {
      state.combo = 1;
    }
    state.lastHitTime = now;
    if (state.combo > state.bestComboThisRun) state.bestComboThisRun = state.combo;
    const comboMult = getComboMult(state.combo);
    const earned = Math.round(target.points * bow.scoreMult * comboMult);
    state.score += earned;
    state.targetsHit += 1;
    const label = comboMult > 1 ? `+${earned} ×${comboMult}` : `+${earned}`;
    spawnFloatText(state, target.x, target.y, label, comboMult >= 3 ? "#ef4444" : "#fbbf24");
    if (state.combo > 0 && state.combo % 5 === 0) {
      spawnFloatText(state, state.width / 2, 70, `${state.combo} COMBO!`, "#fb923c");
    }
    spawnParticles(state, target.x, target.y, target.color || "#fbbf24", target.type === "boss" || target.type === "megaBoss" || target.type === "zeppelin" ? 36 : 16, target.type === "boss" || target.type === "megaBoss" || target.type === "zeppelin");
    if (target.type === "megaBoss") {
      // CINEMATIC: massive shockwaves, slow-mo, guaranteed legendary drop
      state.shockwaves = state.shockwaves || [];
      state.shockwaves.push({ x: target.x, y: target.y, r: 10, maxR: 260, life: 1, color: "#ef4444" });
      state.shockwaves.push({ x: target.x, y: target.y, r: 4, maxR: 340, life: 1, color: "#fde68a" });
      state.shockwaves.push({ x: target.x, y: target.y, r: 2, maxR: 420, life: 1, color: "#fb923c" });
      state.shake = Math.max(state.shake || 0, 28);
      sounds.explosion();
      // Force slow-mo for 2 seconds (cinematic)
      state.activePowerUp = { type: "slowmo", expiresAt: performance.now() + 2000 };
      // EPIC label
      spawnFloatText(state, state.width / 2, state.height / 2 - 40, "EPIC TAKEDOWN!", "#fde047");
      spawnFloatText(state, state.width / 2, state.height / 2, `+${earned}`, "#fbbf24");
      // GUARANTEED legendary drop (explosive arrows, max ammo)
      state.drops.push({
        x: target.x, y: target.y, vy: 0.3, kind: "explosive", alive: true, t: 0, legendary: true,
      });
      // PLUS an extra bonus power-up (triple)
      state.drops.push({
        x: target.x + 40, y: target.y - 20, vy: 0.3, kind: "triple", alive: true, t: 0,
      });
    } else if (target.type === "zeppelin" || target.type === "boss") {
      state.shockwaves = state.shockwaves || [];
      state.shockwaves.push({ x: target.x, y: target.y, r: 8, maxR: 140, life: 1, color: "#fde68a" });
      state.shake = Math.max(state.shake || 0, 8);
    }
    if (target.type === "balloon" || target.type === "giantBalloon") sounds.pop();
    else sounds.hit();
    maybeDropPowerUp(state, target.x, target.y, target);
  } else {
    sounds.hit();
    spawnParticles(state, target.x, target.y, "#fff", 6);
  }
};

const checkLevelUp = (state) => {
  if (state.targetsHit >= state.targetsForLevel) {
    // Award coins: based on score gained this level + level bonus
    const scoreThisLevel = state.score - state.scoreAtLevelStart;
    state.coinsEarnedThisLevel = Math.floor(scoreThisLevel / 75) + Math.floor(state.level / 2);
    state.coins += state.coinsEarnedThisLevel;
    persistProgress(state);

    state.level += 1;
    state.targetsHit = 0;
    state.targetsForLevel = 10 + state.level * 2;
    state.spawnInterval = Math.max(400, 1400 - state.level * 75);
    state.scoreAtLevelStart = state.score;
    state.theme = getThemeForLevel(state.level);
    state._megaBossSpawned = false;
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
        // BOLT consumable: chain to nearest balloon while active
        if (state.chainUntil && performance.now() < state.chainUntil && !a._chainSpawned) {
          let nearest = null, nd = 280 * 280;
          for (const ct of state.targets) {
            if (!ct.alive || ct === t) continue;
            if (ct.type !== "balloon" && ct.type !== "giantBalloon" && ct.type !== "bullseye") continue;
            const cdx = ct.x - t.x, cdy = ct.y - t.y;
            const dist2 = cdx * cdx + cdy * cdy;
            if (dist2 < nd) { nd = dist2; nearest = ct; }
          }
          if (nearest) {
            const cdx = nearest.x - t.x, cdy = nearest.y - t.y;
            const dist = Math.hypot(cdx, cdy) || 1;
            const sp = 18;
            state.arrows.push({
              x: t.x, y: t.y,
              vx: (cdx / dist) * sp, vy: (cdy / dist) * sp,
              rotation: Math.atan2(cdy, cdx),
              alive: true, explosive: false, bowId: a.bowId,
              trail: [], _chainSpawned: true, _chain: true,
            });
          }
        }
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
      // Boss attack
      t.attackTimer -= dt * slow;
      if (t.attackTimer <= 0 && t.x < state.width - 30) {
        const dx = state.bow.x - t.x;
        const dy = state.bow.y - t.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = 5.5;
        state.enemyProjectiles.push({
          x: t.x - t.r, y: t.y,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          r: 10, t: 0, alive: true, hp: 1,
        });
        t.attackTimer = 1500 + Math.random() * 1500;
      }
    } else if (t.type === "giantBalloon") {
      t.sway.t += dt * slow;
      t.y += t.vy * slow + Math.sin(t.sway.t * t.sway.freq) * 0.4;
    } else if (t.type === "zeppelin") {
      t.bob.t += dt * slow;
      t.y += Math.sin(t.bob.t * t.bob.freq) * 0.4;
      t.propeller = (t.propeller || 0) + dt * 0.02 * slow;
    } else if (t.type === "megaBoss") {
      t.bob.t += dt * slow;
      t.y += Math.sin(t.bob.t * t.bob.freq) * 0.8;
      // Mega boss stops at right portion of screen
      if (t.x < state.width - 180) t.vx = 0;
      t.attackTimer -= dt * slow;
      if (t.attackTimer <= 0 && t.x < state.width - 30) {
        // Fire a 3-shot fan at the bow
        const baseAngle = Math.atan2(state.bow.y - t.y, state.bow.x - t.x);
        for (const offset of [-0.18, 0, 0.18]) {
          const a = baseAngle + offset;
          state.enemyProjectiles.push({
            x: t.x - t.r, y: t.y,
            vx: Math.cos(a) * 5.5,
            vy: Math.sin(a) * 5.5,
            r: 12, t: 0, alive: true, hp: 1, mega: true,
          });
        }
        t.attackTimer = 1100 + Math.random() * 700;
      }
    } else if (t.type === "stormGiant") {
      t.bob.t += dt * slow;
      t.y += Math.sin(t.bob.t * t.bob.freq) * 0.9;
      // Stops in right portion to bombard player
      if (t.x < state.width - 220) t.vx = 0;
      t.attackTimer -= dt * slow;
      t.lightning = Math.max(0, (t.lightning || 0) - dt);
      if (t.attackTimer <= 0 && t.x < state.width - 30) {
        // Rapid 5-shot wide fan + 1 homing-ish straight shot
        const baseAngle = Math.atan2(state.bow.y - t.y, state.bow.x - t.x);
        for (const offset of [-0.32, -0.16, 0, 0.16, 0.32]) {
          const a = baseAngle + offset;
          state.enemyProjectiles.push({
            x: t.x - t.r, y: t.y,
            vx: Math.cos(a) * 6.2,
            vy: Math.sin(a) * 6.2,
            r: 11, t: 0, alive: true, hp: 1, storm: true,
          });
        }
        t.lightning = 380; // flash visual
        t.attackTimer = 900 + Math.random() * 500;
      }
    }
    // Missed target - reached the bow side
    if (t.x < -40) {
      t.alive = false;
      // Bosses, flyers, zeppelins, megaBoss & stormGiant cost a life if they escape
      const costly = ["boss", "flyer", "zeppelin", "megaBoss", "stormGiant"];
      if (costly.includes(t.type)) {
        const cost = t.type === "megaBoss" ? 3 : t.type === "stormGiant" ? 4 : 1;
        state.lives -= cost;
        sounds.miss();
        spawnFloatText(state, 60, state.height - 40, `-${cost} LIFE`, "#ef4444");
        if (state.lives <= 0) {
          state.status = "gameOver";
          sounds.gameOver();
        }
      }
    }
  }
  state.targets = state.targets.filter((t) => t.alive);

  // Drops (with optional magnet attraction)
  const magnet = state.ownedItems.includes("magnet");
  for (const d of state.drops) {
    if (!d.alive) continue;
    d.t += dt * slow;
    if (magnet && state.arrows.length > 0) {
      // pull toward nearest arrow within 220px
      let nearest = null;
      let nd = 220 * 220;
      for (const a of state.arrows) {
        if (!a.alive) continue;
        const dx = a.x - d.x, dy = a.y - d.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < nd) { nd = dist2; nearest = a; }
      }
      if (nearest) {
        const dx = nearest.x - d.x, dy = nearest.y - d.y;
        const dist = Math.hypot(dx, dy) || 1;
        d.x += (dx / dist) * 4.5 * slow;
        d.y += (dy / dist) * 4.5 * slow;
      } else {
        d.y += d.vy * slow;
        d.x -= 0.4 * slow;
        if (d.y > state.height - 80) d.vy = -d.vy * 0.5;
      }
    } else {
      d.y += d.vy * slow;
      d.x -= 0.4 * slow;
      if (d.y > state.height - 80) d.vy = -d.vy * 0.5;
    }
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

  // Enemy projectiles (boss fireballs) — now also destructible by arrows
  for (const p of state.enemyProjectiles) {
    if (!p.alive) continue;
    p.t += dt * slow;
    p.x += p.vx * slow;
    p.y += p.vy * slow;
    if (p.x < -30 || p.y > state.height + 30 || p.y < -30) p.alive = false;
    // Player arrow can shoot down the fireball
    for (const a of state.arrows) {
      if (!a.alive) continue;
      const adx = a.x - p.x, ady = a.y - p.y;
      if (adx * adx + ady * ady < (p.r + 6) ** 2) {
        p.alive = false;
        a.alive = false;
        state.score += p.mega ? 30 : 15;
        spawnFloatText(state, p.x, p.y, p.mega ? "+30" : "+15", "#22d3ee");
        spawnParticles(state, p.x, p.y, "#fde68a", 14, true);
        state.shockwaves.push({ x: p.x, y: p.y, r: 6, maxR: 60, life: 1, color: "#fde68a" });
        sounds.hit();
        break;
      }
    }
    if (!p.alive) continue;
    // Collide with bow (player)
    const dx = p.x - state.bow.x, dy = p.y - state.bow.y;
    if (dx * dx + dy * dy < (28) ** 2) {
      p.alive = false;
      state.lives -= 1;
      state.combo = 0; // break combo on hit
      sounds.miss();
      spawnParticles(state, p.x, p.y, "#fb923c", 14, true);
      state.shake = Math.max(state.shake || 0, 14);
      spawnFloatText(state, 60, state.height - 40, "-1 LIFE", "#ef4444");
      if (state.lives <= 0) {
        state.status = "gameOver";
        sounds.gameOver();
      }
    }
  }
  state.enemyProjectiles = state.enemyProjectiles.filter((p) => p.alive);

  // Shockwaves
  for (const w of state.shockwaves || []) {
    w.r += (w.maxR - w.r) * 0.18;
    w.life -= 0.04;
  }
  state.shockwaves = (state.shockwaves || []).filter((w) => w.life > 0);

  // Laser beams (fade quickly, render-only after damage applied at fire time)
  for (const ls of state.lasers || []) ls.life -= 0.06;
  state.lasers = (state.lasers || []).filter((l) => l.life > 0);

  // Pending laser charge — auto-fire when ready
  if (state.pendingLaser && performance.now() >= state.pendingLaser.fireAt) {
    state.pendingLaser = null;
    fireLaser(state);
  }

  // Screen shake decay
  if (state.shake > 0) state.shake = Math.max(0, state.shake - 0.6);

  // Reset combo if timeout exceeded
  if (state.combo > 0 && performance.now() - state.lastHitTime > state.comboTimeoutMs) {
    state.combo = 0;
  }

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
