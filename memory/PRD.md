# Arrow Strike — 2D Archery Game

## Original Problem Statement
"make me arrow shooting game 2d"

## User Choices
- Game style: Archery target practice + Defend the castle hybrid
- Theme: Cartoon / playful + Minimalist modern
- Features: Score + high score, power-ups, multiple levels with increasing difficulty
- Sound effects: Yes

## Architecture
- **Pure frontend**: React 19 + HTML5 Canvas
- **Rendering**: Custom canvas renderer (`/app/frontend/src/game/render.js`)
- **Logic**: Frame-loop physics engine (`/app/frontend/src/game/engine.js`)
- **Audio**: Web Audio API synthetic sounds — no external audio assets (`/app/frontend/src/game/sounds.js`)
- **State**: React refs + localStorage for high score (key `archery_high_score_v1`)
- **No backend or third-party integrations required**

## Core Requirements (static)
- Bow on the left, aim with mouse, hold to charge, release to fire
- Arrow physics: gravity-affected projectile with trail
- Targets fly in from the right with varied patterns
- HUD: score, level, hit progress, lives, active power-up
- Progressive difficulty: more targets, faster, more variety per level
- Sound effects for every key action (bow draw, shoot, hit, pop, miss, level up, game over, power-up, explosion)
- Power-ups: triple shot (5 ammo), slow-mo (5s), explosive arrow (3 ammo)

## What's Been Implemented (2026-02)
- Menu, playing, paused, level-complete, game-over screens
- Bow + arrow nocking animation with power meter
- Four enemy types: balloon (10pt), bullseye (25pt), flyer (40pt, costs a life if escapes), boss (100pt, 3 HP, costs a life if escapes)
- Three power-ups dropped randomly from killed enemies (higher chance from harder enemies)
- Particle effects + floating score text
- Cartoon background: gradient sky, sun, parallax clouds, hills, grass
- Sound toggle, high score persistence, responsive canvas sizing

### Iteration 2 (2026-02)
- **Coin economy**: earn coins on level complete = floor(scoreThisLevel/6) + level*15. Persisted in localStorage.
- **Shop dialog** (shadcn Dialog + Tabs) with header button + level-complete shortcut
- **4 bows** with unique abilities:
  - Wooden (free, equipped): 1 arrow, baseline
  - Emerald (250): 2-arrow spread
  - Amethyst (600): 3-arrow spread
  - Diamond (1200): 1 arrow, +35% speed, 1.5x score
- **4 passive items** (one-time purchase, permanent):
  - Quick Draw Gloves (200): charge 40% faster
  - Eagle Eye (300): arrows 25% faster
  - Lucky Charm (450): +70% power-up drop chance
  - Extra Heart (400): start runs with 4 lives
- **Theme cycle** by level (day → sunset → night, repeats every 6): night has moon, stars, fireflies; sunset has low burning sun and warmer palette
- **More levels** via dynamically increasing target counts and faster spawn intervals (capped at 400ms)

### Iteration 3 (2026-02)
- **Combo / streak multiplier**: chain hits within 2.5s. 3=×1.5, 5=×2, 8=×3, 12+=×5. Big "x3 STREAK" badge in scene.
- **Boss attack patterns**: bosses periodically fire glowing fireballs aimed at the bow; player loses a life & combo on hit
- **Ruby Bow** (1800, Legendary): every arrow explodes on impact, no power-up needed
- **Arrow Magnet** item (550): power-up crates fly toward your nearest arrow within 220px
- **Global Leaderboard** (backend): `POST /api/leaderboard/submit` and `GET /api/leaderboard/top?limit=100`. Stored in MongoDB collection `leaderboard`, keyed by lowercase name, keeps best (highest level, then score).
- **Name prompt dialog** on first launch, name saved to localStorage `archery_player_name`
- **Phoenix Bow** (Mythic, gated): 5-arrow flaming spread, ×2.5 score, ×1.5 arrow speed — only equippable while your name is in the top 3 of the global leaderboard.
- All 12 testing-agent checks passed (100% backend + 100% frontend)

### Iteration 4 (2026-02)
- **Keyboard shortcuts**: Space = pause/resume, R = restart run, S = toggle shop, L = toggle leaderboard. Ignores key events when typing in inputs.
- **Mobile / touch controls**: canvas now responds to touchstart/touchmove/touchend, mirroring mouse-down/move/up. `touch-action: none` on canvas to prevent scroll while aiming.
- Verified end-to-end via screenshot: S/L/R/Space all working from menu and gameplay.

### Deferred to Iteration 5
- **Optional Emergent Google Auth** for cross-device name claiming. Needs `integration_playbook_expert_v2` for the Emergent Auth playbook, env wiring, and a profile/claim flow that ties the local `archery_player_name` to an authenticated identity server-side. Scoped out to keep this iteration focused.

### Iteration 5 (2026-02)
- **Gravity**: 0.32 → **0.12** for straighter arrow flight
- **Main menu split**: "Play" + "Multiplayer" buttons. Multiplayer dialog locks in the design (100 HP, 2× Shield 5s, 1× +30 HP, 2× Triple-Shot 5s, arrow-tanks-on-bow, separate ranked board). PvP build deferred (WebSocket server is a multi-iter effort).

### Iteration 6 (2026-02)
- **Giant Balloon** (lvl 4+, 4 HP, 150 pts, fat lazy float)
- **Zeppelin** (lvl 5+, 6 HP, 250 pts) — large airship with spinning propeller, cabin lights, tail fins, HP bar
- **Mega Boss** every 10th level — 15+`level` HP, 1000 pts, crowned demonic balloon with rotating spikes, glowing eyes, 3-shot fireball fan attack pattern, drops 3 lives on escape (vs 1 for normal bosses)
- **Boss fireballs now destructible**: arrows can shoot down incoming fireballs (+15 pts; +30 for mega-boss fireballs), with sparkle particles + shockwave ring
- **More effects**: screen shake on hits/explosions/mega-boss spawn, expanding shockwave rings on explosions and mega-boss death, larger particle bursts for big enemies
- Verified end-to-end via playwright: zero page errors during gameplay, smooth render
- All 10 testing-agent flows passed (100%)

## Personas
- Casual web gamer wanting a quick browser-based arcade experience

## Prioritized Backlog (next phase)
- P1: Mobile / touch controls (currently mouse-only)
- P1: Keyboard shortcut to pause (Space / Esc)
- P2: Combo / streak multiplier and floating "Headshot!" labels
- P2: Boss attack patterns (counter-shoot at player)
- P2: Cosmetic unlocks: new bow skins / arrow trails at score milestones
- P3: Local 1v1 turn-based mode (William Tell apple shot)

## Next Tasks
- Gather user feedback on difficulty curve and tune spawn intervals
- Add touch support if mobile usage is requested
