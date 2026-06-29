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
- All 11 testing-agent UI flows passed (100%)

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
