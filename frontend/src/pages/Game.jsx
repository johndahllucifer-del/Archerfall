import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Heart, Volume2, VolumeX, Trophy, Zap, Clock, Bomb, Play, Pause, RotateCcw, Target as TargetIcon, ShoppingBag, Coins, Check, Lock, Medal, Flame, Swords, HeartHandshake } from "lucide-react";
import {
  createInitialState,
  resetForNewGame,
  updateBowAngle,
  startCharge,
  releaseShot,
  updatePhysics,
  buyBow,
  equipBow,
  buyItem,
} from "@/game/engine";
import { drawScene } from "@/game/render";
import { initAudio, setSoundEnabled, sounds } from "@/game/sounds";
import { BOWS, ITEMS } from "@/game/shop";
import { submitScore, fetchLeaderboard, getPlayerName, setPlayerName } from "@/services/leaderboard";
import { COIN_PACKS, SUPPORT_TIERS, startCoinCheckout, startSupportCheckout, pollCheckout } from "@/services/payments";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

const HIGH_SCORE_KEY = "archery_high_score_v1";

export default function Game() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const [, setTick] = useState(0); // force re-render for HUD
  const [highScore, setHighScore] = useState(() => {
    const v = localStorage.getItem(HIGH_SCORE_KEY);
    return v ? parseInt(v, 10) : 0;
  });
  const [soundOn, setSoundOn] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 720 });
  const [shopOpen, setShopOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [mpOpen, setMpOpen] = useState(false);
  const [board, setBoard] = useState([]);
  const [playerName, setName] = useState(() => getPlayerName());
  const [nameDraft, setNameDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [coinShopOpen, setCoinShopOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [customTip, setCustomTip] = useState("");
  const [queueOpen, setQueueOpen] = useState(false);
  // Setup canvas size to view
  useEffect(() => {
    const compute = () => {
      const w = Math.min(1400, window.innerWidth - 32);
      const h = Math.min(820, window.innerHeight - 140);
      setDimensions({ width: w, height: Math.max(480, h) });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Initialize state
  useEffect(() => {
    stateRef.current = createInitialState(dimensions.width, dimensions.height);
  }, [dimensions.width, dimensions.height]);

  useEffect(() => {
    setSoundEnabled(soundOn);
  }, [soundOn]);

  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const loop = (time) => {
      const state = stateRef.current;
      if (!state) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const dt = Math.min(50, time - (lastTimeRef.current || time));
      lastTimeRef.current = time;
      updateBowAngle(state);
      updatePhysics(state, dt);
      drawScene(ctx, state, time);
      // Trigger HUD updates ~ every frame (cheap, single component)
      if (Math.floor(time / 100) % 1 === 0) forceUpdate();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [forceUpdate]);

  // Save high score
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    if (state.status === "gameOver" && state.score > highScore) {
      localStorage.setItem(HIGH_SCORE_KEY, String(state.score));
      setHighScore(state.score);
    }
  });

  // Refresh leaderboard + update Phoenix gate based on top 3
  const refreshLeaderboard = useCallback(async () => {
    const data = await fetchLeaderboard(100);
    setBoard(data);
    const state = stateRef.current;
    if (state) {
      const top3Names = data.slice(0, 3).map((e) => (e.name || "").toLowerCase());
      const myName = (playerName || "").toLowerCase();
      state.phoenixUnlocked = !!(myName && top3Names.includes(myName));
      forceUpdate();
    }
  }, [playerName, forceUpdate]);

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  // Handle return from Stripe Checkout: poll, then credit coins locally if applicable
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    const purpose = params.get("payment");
    if (!sid) return;
    // Clean URL so we don't re-process on remounts
    window.history.replaceState({}, "", window.location.pathname);
    (async () => {
      toast.loading("Confirming your payment…", { id: "pay" });
      const res = await pollCheckout(sid);
      if (res.ok) {
        if (purpose === "coins" && res.coins_credited > 0) {
          const st = stateRef.current;
          if (st) {
            st.coins += res.coins_credited;
            // Persist new coin balance to localStorage
            try {
              localStorage.setItem("archery_coins_v1", String(st.coins));
            } catch (e) { /* ignore */ }
            forceUpdate();
          }
          toast.success(`+${res.coins_credited} coins added!`, { id: "pay" });
          sounds.powerUp();
        } else if (purpose === "support") {
          toast.success("Thanks for the support 💛", { id: "pay" });
          sounds.levelUp();
        } else {
          toast.success("Payment confirmed!", { id: "pay" });
        }
      } else {
        toast.error("Payment not completed.", { id: "pay" });
      }
    })();
  }, [forceUpdate]);

  const buyCoinPack = async (pack) => {
    if (paying) return;
    if (!playerName) { toast.error("Set your name first"); return; }
    try {
      setPaying(true);
      const { url } = await startCoinCheckout(pack.id, playerName);
      window.location.href = url;
    } catch (e) {
      console.error(e);
      toast.error("Couldn't start checkout");
      setPaying(false);
    }
  };

  const sendSupport = async ({ tierId, customAmount }) => {
    if (paying) return;
    try {
      setPaying(true);
      const { url } = await startSupportCheckout({ tierId, customAmount });
      window.location.href = url;
    } catch (e) {
      console.error(e);
      toast.error("Couldn't start support checkout");
      setPaying(false);
    }
  };

  // Keyboard shortcuts: Space=pause, R=restart, S=shop, L=leaderboard, Esc closes dialogs
  useEffect(() => {
    const onKey = (e) => {
      // Ignore typing into name input
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      const state = stateRef.current;
      if (!state) return;
      const k = e.key.toLowerCase();
      if (e.code === "Space" || k === " ") {
        if (state.status === "playing" || state.status === "paused") {
          e.preventDefault();
          pauseToggle();
        }
      } else if (k === "r") {
        e.preventDefault();
        startGame();
      } else if (k === "s") {
        e.preventDefault();
        sounds.click();
        setShopOpen((v) => !v);
      } else if (k === "l") {
        e.preventDefault();
        sounds.click();
        refreshLeaderboard();
        setBoardOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refreshLeaderboard]);

  // Submit score on game over
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    if (state.status === "gameOver" && playerName && !submitted) {
      setSubmitted(true);
      (async () => {
        await submitScore(playerName, state.level, state.score);
        await refreshLeaderboard();
      })();
    }
    if (state?.status !== "gameOver" && submitted) setSubmitted(false);
  });

  // Mouse handlers
  const getMouse = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvasRef.current.width) / rect.width,
      y: ((e.clientY - rect.top) * canvasRef.current.height) / rect.height,
    };
  };

  const onMouseMove = (e) => {
    const state = stateRef.current;
    if (!state) return;
    const m = getMouse(e);
    state.mouse.x = m.x;
    state.mouse.y = m.y;
  };

  const onMouseDown = (e) => {
    initAudio();
    const state = stateRef.current;
    if (!state) return;
    const m = getMouse(e);
    state.mouse.x = m.x;
    state.mouse.y = m.y;
    startCharge(state);
  };

  const onMouseUp = () => {
    const state = stateRef.current;
    if (!state) return;
    releaseShot(state);
  };

  // Touch handlers (mobile)
  const onTouchStart = (e) => {
    e.preventDefault();
    initAudio();
    const state = stateRef.current;
    if (!state || !e.touches[0]) return;
    const rect = canvasRef.current.getBoundingClientRect();
    state.mouse.x = ((e.touches[0].clientX - rect.left) * canvasRef.current.width) / rect.width;
    state.mouse.y = ((e.touches[0].clientY - rect.top) * canvasRef.current.height) / rect.height;
    startCharge(state);
  };
  const onTouchMove = (e) => {
    e.preventDefault();
    const state = stateRef.current;
    if (!state || !e.touches[0]) return;
    const rect = canvasRef.current.getBoundingClientRect();
    state.mouse.x = ((e.touches[0].clientX - rect.left) * canvasRef.current.width) / rect.width;
    state.mouse.y = ((e.touches[0].clientY - rect.top) * canvasRef.current.height) / rect.height;
  };
  const onTouchEnd = (e) => {
    e.preventDefault();
    const state = stateRef.current;
    if (!state) return;
    releaseShot(state);
  };

  const startGame = () => {
    initAudio();
    sounds.click();
    const state = stateRef.current;
    if (!state) return;
    resetForNewGame(state);
  };

  const nextLevel = () => {
    sounds.click();
    const state = stateRef.current;
    if (!state) return;
    state.status = "playing";
  };

  const pauseToggle = () => {
    sounds.click();
    const state = stateRef.current;
    if (!state) return;
    if (state.status === "playing") state.status = "paused";
    else if (state.status === "paused") state.status = "playing";
  };

  const goMenu = () => {
    sounds.click();
    const state = stateRef.current;
    if (!state) return;
    state.status = "menu";
  };

  const handleBuyBow = (id) => {
    const state = stateRef.current;
    if (!state) return;
    if (buyBow(state, id)) sounds.powerUp();
    forceUpdate();
  };
  const handleEquipBow = (id) => {
    const state = stateRef.current;
    if (!state) return;
    if (equipBow(state, id)) sounds.click();
    forceUpdate();
  };
  const handleBuyItem = (id) => {
    const state = stateRef.current;
    if (!state) return;
    if (buyItem(state, id)) sounds.powerUp();
    forceUpdate();
  };

  const state = stateRef.current;
  const status = state?.status || "menu";

  return (
    <div
      className="min-h-screen w-full no-select"
      style={{
        background: "linear-gradient(180deg, #fff5e1 0%, #ffe0ec 50%, #e0f0ff 100%)",
        fontFamily: "'Bricolage Grotesque', sans-serif",
      }}
    >
      <div className="max-w-[1440px] mx-auto px-4 pt-4 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shadow-md">
              <TargetIcon className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800" data-testid="game-title">
                Arrow Strike
              </h1>
              <p className="text-xs text-slate-500 -mt-1">Aim. Charge. Release.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100/90 border border-amber-200 shadow-sm" data-testid="header-coins">
              <Coins className="w-4 h-4 text-amber-600" />
              <span className="font-mono-game text-sm font-bold text-amber-700">{state?.coins ?? 0}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="bg-amber-50 border-amber-300 text-amber-800 btn-press hidden sm:inline-flex"
              onClick={() => { sounds.click(); setCoinShopOpen(true); }}
              data-testid="open-coinshop-button"
            >
              <Coins className="w-4 h-4 mr-1" /> Get Coins
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-rose-50 border-rose-300 text-rose-700 btn-press hidden sm:inline-flex"
              onClick={() => { sounds.click(); setSupportOpen(true); }}
              data-testid="open-support-button"
            >
              <HeartHandshake className="w-4 h-4 mr-1" /> Support
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-white/80 btn-press"
              onClick={() => { sounds.click(); setShopOpen(true); }}
              data-testid="open-shop-button"
            >
              <ShoppingBag className="w-4 h-4 mr-1" /> Shop
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-white/80 btn-press"
              onClick={() => { sounds.click(); refreshLeaderboard(); setBoardOpen(true); }}
              data-testid="open-leaderboard-button"
            >
              <Medal className="w-4 h-4 mr-1" /> Leaderboard
            </Button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-white shadow-sm">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="font-mono-game text-sm font-bold text-slate-700" data-testid="header-high-score">
                {highScore}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-white shadow-sm">
              {soundOn ? <Volume2 className="w-4 h-4 text-slate-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              <Switch checked={soundOn} onCheckedChange={setSoundOn} data-testid="sound-toggle" />
            </div>
          </div>
        </div>

        {/* HUD */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="outline" className="bg-white/80 border-orange-200 px-3 py-1.5 text-sm" data-testid="hud-score">
            <span className="text-slate-500 mr-1.5">Score</span>
            <span className="font-mono-game font-bold text-slate-800">{state?.score ?? 0}</span>
          </Badge>
          <Badge variant="outline" className="bg-white/80 border-blue-200 px-3 py-1.5 text-sm" data-testid="hud-level">
            <span className="text-slate-500 mr-1.5">Level</span>
            <span className="font-mono-game font-bold text-slate-800">{state?.level ?? 1}</span>
          </Badge>
          <Badge variant="outline" className="bg-white/80 border-emerald-200 px-3 py-1.5 text-sm" data-testid="hud-progress">
            <span className="text-slate-500 mr-1.5">Hits</span>
            <span className="font-mono-game font-bold text-slate-800">
              {state?.targetsHit ?? 0}/{state?.targetsForLevel ?? 10}
            </span>
          </Badge>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-md border bg-white/80 border-rose-200" data-testid="hud-lives">
            {[0, 1, 2].map((i) => (
              <Heart
                key={i}
                className={`w-4 h-4 ${i < (state?.lives ?? 0) ? "text-rose-500 fill-rose-500" : "text-slate-300"}`}
              />
            ))}
          </div>
          {state?.activePowerUp && (
            <Badge className="bg-gradient-to-r from-cyan-400 to-violet-500 text-white px-3 py-1.5 text-sm border-0 scale-pop" data-testid="hud-powerup">
              {state.activePowerUp.type === "triple" && <><Zap className="w-3.5 h-3.5 mr-1" />Triple x{state.activePowerUp.ammo}</>}
              {state.activePowerUp.type === "slowmo" && <><Clock className="w-3.5 h-3.5 mr-1" />Slow-Mo {Math.max(0, Math.ceil((state.activePowerUp.expiresAt - performance.now()) / 1000))}s</>}
              {state.activePowerUp.type === "explosive" && <><Bomb className="w-3.5 h-3.5 mr-1" />Boom x{state.activePowerUp.ammo}</>}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            {status === "playing" || status === "paused" ? (
              <Button size="sm" variant="outline" className="bg-white/80 btn-press" onClick={pauseToggle} data-testid="pause-button">
                {status === "playing" ? <><Pause className="w-4 h-4 mr-1" />Pause</> : <><Play className="w-4 h-4 mr-1" />Resume</>}
              </Button>
            ) : null}
            {(status === "playing" || status === "paused" || status === "gameOver") && (
              <Button size="sm" variant="outline" className="bg-white/80 btn-press" onClick={goMenu} data-testid="menu-button">
                Menu
              </Button>
            )}
          </div>
        </div>

        {/* Canvas wrapper */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white" style={{ width: dimensions.width, maxWidth: "100%" }}>
          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            className="game-canvas touch-none"
            onMouseMove={onMouseMove}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
            data-testid="game-canvas"
          />

          {/* Menu overlay */}
          {status === "menu" && (
            <Overlay>
              <Card className="px-10 py-8 bg-white/95 border-0 shadow-2xl scale-pop max-w-md text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center mb-4">
                  <TargetIcon className="w-9 h-9 text-white" strokeWidth={2.5} />
                </div>
                <h2 className="text-4xl font-extrabold text-slate-800 mb-2">Arrow Strike</h2>
                <p className="text-slate-500 mb-6 text-sm">
                  Hold <span className="font-bold text-slate-700">left-click</span> to draw the bow,
                  release to fire. Mind the gravity!
                </p>
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 text-white font-bold text-lg shadow-lg pulse-glow btn-press"
                  onClick={startGame}
                  data-testid="start-game-button"
                >
                  <Play className="w-5 h-5 mr-2" /> Play
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full mt-2 font-bold text-base border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 btn-press"
                  onClick={() => { sounds.click(); setMpOpen(true); }}
                  data-testid="multiplayer-button"
                >
                  <Swords className="w-5 h-5 mr-2" /> Multiplayer
                </Button>
                <div className="mt-5 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                  <LegendChip color="bg-cyan-400" label="3x Multi" />
                  <LegendChip color="bg-violet-400" label="Slow-Mo" />
                  <LegendChip color="bg-rose-400" label="Boom" />
                </div>
                <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Trophy className="w-4 h-4 text-amber-500" /> High Score:
                  <span className="font-mono-game font-bold text-slate-700" data-testid="menu-high-score">{highScore}</span>
                </div>
              </Card>
            </Overlay>
          )}

          {status === "paused" && (
            <Overlay>
              <Card className="px-10 py-8 bg-white/95 border-0 shadow-2xl scale-pop text-center">
                <h2 className="text-3xl font-extrabold text-slate-800 mb-4">Paused</h2>
                <Button onClick={pauseToggle} className="bg-slate-800 hover:bg-slate-900 text-white" data-testid="resume-button">
                  <Play className="w-4 h-4 mr-2" /> Resume
                </Button>
              </Card>
            </Overlay>
          )}

          {status === "levelComplete" && (
            <Overlay>
              <Card className="px-10 py-8 bg-white/95 border-0 shadow-2xl scale-pop text-center max-w-md">
                <div className="text-5xl mb-2">★</div>
                <h2 className="text-3xl font-extrabold text-slate-800">Level {state.level - 1} Complete!</h2>
                <p className="text-slate-500 mt-1 mb-4 text-sm">
                  Next: <span className="font-bold text-slate-700">Level {state.level}</span>
                  {state.theme === "night" && <span className="ml-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-900 text-indigo-100 text-[10px] font-bold">NIGHT</span>}
                  {state.theme === "sunset" && <span className="ml-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">SUNSET</span>}
                </p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <Stat label="Score" value={state.score} />
                  <Stat label="Lives" value={state.lives} accent="rose" />
                  <Stat label="+Coins" value={state.coinsEarnedThisLevel} accent="amber" />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 btn-press"
                    onClick={() => { sounds.click(); setShopOpen(true); }}
                    data-testid="level-shop-button"
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" /> Shop
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-emerald-400 to-cyan-500 text-white font-bold btn-press"
                    onClick={nextLevel}
                    data-testid="next-level-button"
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </Overlay>
          )}

          {status === "gameOver" && (
            <Overlay>
              <Card className="px-10 py-8 bg-white/95 border-0 shadow-2xl scale-pop text-center max-w-md">
                <h2 className="text-4xl font-extrabold text-slate-800 mb-1">Game Over</h2>
                <p className="text-slate-500 text-sm mb-5">Nice run, archer.</p>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <Stat label="Final Score" value={state.score} />
                  <Stat label="Best" value={Math.max(state.score, highScore)} accent="amber" />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-slate-800 hover:bg-slate-900 text-white btn-press" onClick={startGame} data-testid="play-again-button">
                    <RotateCcw className="w-4 h-4 mr-2" /> Play Again
                  </Button>
                  <Button variant="outline" onClick={goMenu} data-testid="back-to-menu-button">Menu</Button>
                </div>
              </Card>
            </Overlay>
          )}
        </div>

        {/* Footer hint */}
        <div className="mt-3 text-center text-xs text-slate-500">
          <span className="font-mono-game">L-Click hold</span> = charge & aim &nbsp;·&nbsp;
          <span className="font-mono-game">release</span> = shoot &nbsp;·&nbsp;
          <span className="font-mono-game">Space</span>=pause &nbsp;
          <span className="font-mono-game">R</span>=restart &nbsp;
          <span className="font-mono-game">S</span>=shop &nbsp;
          <span className="font-mono-game">L</span>=board
        </div>
      </div>

      <ShopDialog
        open={shopOpen}
        onOpenChange={setShopOpen}
        state={state}
        onBuyBow={handleBuyBow}
        onEquipBow={handleEquipBow}
        onBuyItem={handleBuyItem}
      />
      <LeaderboardDialog
        open={boardOpen}
        onOpenChange={setBoardOpen}
        board={board}
        playerName={playerName}
      />
      <NameDialog
        open={!playerName}
        onSave={(n) => {
          const saved = setPlayerName(n);
          if (saved) setName(saved);
        }}
        draft={nameDraft}
        setDraft={setNameDraft}
      />
      <Dialog open={mpOpen} onOpenChange={setMpOpen}>
        <DialogContent className="max-w-lg bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 border-0 text-white" data-testid="multiplayer-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold">
              <Swords className="w-6 h-6 text-orange-400" /> Multiplayer · Castle Siege
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              Real-time 1v1 PvP coming next iteration. Here&apos;s the locked-in design:
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-slate-200">
            <li>· Online matchmaking over WebSockets</li>
            <li>· Castles start at <span className="font-bold text-amber-300">100 HP</span>, arrow on castle = <span className="font-bold">10 dmg</span></li>
            <li>· Straighter arrow trajectory (gravity already reduced ✓)</li>
            <li>· Fixed kit per match: <span className="font-bold text-cyan-300">2× Shield (5s)</span>, <span className="font-bold text-emerald-300">1× +30 HP Boost</span>, <span className="font-bold text-rose-300">2× Triple-Shot (5s)</span></li>
            <li>· If an opponent&apos;s arrow hits your bow first → <span className="font-bold text-orange-300">tanked</span>, no damage</li>
            <li>· Separate ranked leaderboard (ELO-style) for PvP</li>
          </ul>
          <Button className="mt-2 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setMpOpen(false)} data-testid="multiplayer-close">
            Got it
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={coinShopOpen} onOpenChange={setCoinShopOpen}>
        <DialogContent className="max-w-3xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border-0 shadow-2xl" data-testid="coinshop-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
              <Coins className="w-6 h-6 text-amber-500" /> Coin Shop
              <span className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/90 text-amber-900 text-base font-mono-game font-bold">
                <Coins className="w-4 h-4" /> {state?.coins ?? 0}
              </span>
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Top up instantly with a card. Coins arrive on your account the moment your payment confirms.
              You earn 1 coin per 75 score in-game — these packs save you the grind.
            </DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
            {COIN_PACKS.map((pack) => (
              <Card
                key={pack.id}
                className={`p-4 border-2 bg-white/90 ${pack.popular ? "border-orange-400" : pack.best ? "border-amber-500" : "border-slate-200/70"} relative`}
                data-testid={`coinpack-${pack.id}`}
              >
                {pack.popular && (
                  <span className="absolute -top-2 left-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-400 text-white">
                    Most popular
                  </span>
                )}
                {pack.best && (
                  <span className="absolute -top-2 left-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-white">
                    Best value
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md bg-gradient-to-br from-amber-300 to-amber-500">
                    <Coins className="w-7 h-7 text-white" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-800">{pack.label}</div>
                    <div className="text-xs text-slate-500">{pack.tagline}</div>
                    <div className="mt-1 font-mono-game text-xl font-extrabold text-amber-700">{pack.coins.toLocaleString()} coins</div>
                  </div>
                </div>
                <Button
                  className="mt-3 w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold btn-press"
                  disabled={paying || !playerName}
                  onClick={() => buyCoinPack(pack)}
                  data-testid={`coinpack-${pack.id}-buy`}
                >
                  ${pack.price.toFixed(2)}{paying ? "…" : " · Buy"}
                </Button>
              </Card>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Secure card checkout via Stripe. No subscriptions, one-time purchase. Coins are non-refundable
            once delivered.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="max-w-xl bg-gradient-to-br from-rose-50 to-pink-100 border-0 shadow-2xl" data-testid="support-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
              <HeartHandshake className="w-6 h-6 text-rose-500" /> Support Arrow Strike
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Love the game? Throw a tip and help keep development going. Every dollar goes to new
              bows, levels, and the upcoming multiplayer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {SUPPORT_TIERS.map((t) => (
              <Button
                key={t.id}
                variant="outline"
                disabled={paying}
                onClick={() => sendSupport({ tierId: t.id })}
                className="h-auto py-3 flex-col gap-1 bg-white/80 hover:bg-rose-100 border-rose-200 btn-press"
                data-testid={`support-tier-${t.id}`}
              >
                <span className="text-2xl">{t.emoji}</span>
                <span className="text-xs text-slate-500">{t.label}</span>
                <span className="font-mono-game font-bold text-rose-700">${t.amount}</span>
              </Button>
            ))}
          </div>
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">Or a custom amount ($1 - $500)</label>
              <Input
                type="number"
                min={1}
                max={500}
                step="0.01"
                placeholder="e.g. 7.50"
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value)}
                className="bg-white"
                data-testid="support-custom-input"
              />
            </div>
            <Button
              disabled={paying || !customTip || parseFloat(customTip) < 1}
              onClick={() => sendSupport({ customAmount: parseFloat(customTip) })}
              className="bg-rose-500 hover:bg-rose-600 text-white font-bold btn-press"
              data-testid="support-custom-button"
            >
              <HeartHandshake className="w-4 h-4 mr-1" /> Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Toaster position="top-center" richColors />
    </div>
  );
}

const Overlay = ({ children }) => (
  <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm bg-white/30">
    {children}
  </div>
);

const Stat = ({ label, value, accent = "slate" }) => {
  const colors = {
    slate: "text-slate-800",
    rose: "text-rose-500",
    amber: "text-amber-500",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 py-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-mono-game font-extrabold text-2xl ${colors[accent]}`}>{value}</div>
    </div>
  );
};

const LegendChip = ({ color, label }) => (
  <div className="flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 py-1 px-2">
    <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
    <span>{label}</span>
  </div>
);

const ShopDialog = ({ open, onOpenChange, state, onBuyBow, onEquipBow, onBuyItem }) => {
  if (!state) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-gradient-to-br from-white via-amber-50 to-orange-50 border-0 shadow-2xl" data-testid="shop-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
            <ShoppingBag className="w-6 h-6 text-orange-500" />
            Archer&apos;s Shop
            <span className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/90 text-amber-900 text-base font-mono-game font-bold" data-testid="shop-coins">
              <Coins className="w-4 h-4" /> {state.coins}
            </span>
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Spend coins earned from completed levels to unlock powerful bows and gear.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="bows" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bows" data-testid="shop-tab-bows">Bows</TabsTrigger>
            <TabsTrigger value="items" data-testid="shop-tab-items">Items</TabsTrigger>
          </TabsList>
          <TabsContent value="bows" className="mt-4 grid sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
            {Object.values(BOWS).map((bow) => {
              const owned = state.ownedBows.includes(bow.id) || (bow.id === "phoenix" && state.phoenixUnlocked);
              const equipped = state.equippedBow === bow.id;
              const canAfford = state.coins >= bow.cost;
              const Icon = bow.icon;
              const phoenixLocked = bow.id === "phoenix" && !state.phoenixUnlocked;
              return (
                <Card key={bow.id} className={`p-4 border bg-white/80 ${bow.id === "phoenix" ? "border-orange-300 bg-gradient-to-br from-amber-50 to-orange-100" : "border-slate-200/70"}`} data-testid={`shop-bow-${bow.id}`}>
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md"
                      style={{ background: `linear-gradient(135deg, ${bow.color}, ${bow.accent})` }}
                    >
                      <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-800">{bow.name}</div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${bow.rarity === "Mythic" ? "text-orange-600" : "text-slate-400"}`}>{bow.rarity}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{bow.desc}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {bow.cost > 0 ? (
                      <span className="flex items-center gap-1 text-sm font-mono-game font-bold text-amber-700">
                        <Coins className="w-3.5 h-3.5" /> {bow.cost}
                      </span>
                    ) : bow.id === "phoenix" ? (
                      <span className="text-xs font-bold text-orange-600 flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> Top-3 reward</span>
                    ) : (
                      <span className="text-xs text-slate-400">Starter</span>
                    )}
                    {equipped ? (
                      <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white" data-testid={`shop-bow-${bow.id}-equipped`}>
                        <Check className="w-3 h-3 mr-1" /> Equipped
                      </Badge>
                    ) : phoenixLocked ? (
                      <Button size="sm" disabled className="bg-slate-300 text-slate-600" data-testid={`shop-bow-${bow.id}-locked`}>
                        <Lock className="w-3 h-3 mr-1" /> Top 3 only
                      </Button>
                    ) : owned ? (
                      <Button size="sm" variant="outline" onClick={() => onEquipBow(bow.id)} data-testid={`shop-bow-${bow.id}-equip`}>
                        Equip
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!canAfford}
                        onClick={() => onBuyBow(bow.id)}
                        className="bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:opacity-90 disabled:opacity-40"
                        data-testid={`shop-bow-${bow.id}-buy`}
                      >
                        {canAfford ? "Buy" : <><Lock className="w-3 h-3 mr-1" /> Need {bow.cost - state.coins}</>}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </TabsContent>
          <TabsContent value="items" className="mt-4 grid sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
            {Object.values(ITEMS).map((item) => {
              const owned = state.ownedItems.includes(item.id);
              const canAfford = state.coins >= item.cost;
              const Icon = item.icon;
              return (
                <Card key={item.id} className="p-4 border border-slate-200/70 bg-white/80" data-testid={`shop-item-${item.id}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md bg-gradient-to-br ${item.color}`}>
                      <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-800">{item.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm font-mono-game font-bold text-amber-700">
                      <Coins className="w-3.5 h-3.5" /> {item.cost}
                    </span>
                    {owned ? (
                      <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white" data-testid={`shop-item-${item.id}-owned`}>
                        <Check className="w-3 h-3 mr-1" /> Owned
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!canAfford}
                        onClick={() => onBuyItem(item.id)}
                        className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:opacity-90 disabled:opacity-40"
                        data-testid={`shop-item-${item.id}-buy`}
                      >
                        {canAfford ? "Buy" : <><Lock className="w-3 h-3 mr-1" /> Need {item.cost - state.coins}</>}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};


const LeaderboardDialog = ({ open, onOpenChange, board, playerName }) => {
  const myLc = (playerName || "").toLowerCase();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 border-0 shadow-2xl text-white" data-testid="leaderboard-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold">
            <Medal className="w-6 h-6 text-amber-400" />
            Global Leaderboard
            <span className="ml-auto text-xs text-slate-400 font-normal">Top 100 · Sorted by level then score</span>
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Finish each run to submit your best level. The top 3 archers unlock the legendary{" "}
            <span className="text-orange-400 font-bold">Phoenix Bow</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1" data-testid="leaderboard-list">
          {board.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">No scores yet. Be the first to make legend!</div>
          )}
          {board.map((row, i) => {
            const rank = i + 1;
            const isMe = (row.name || "").toLowerCase() === myLc;
            const medalColor =
              rank === 1 ? "from-amber-300 to-yellow-500" :
              rank === 2 ? "from-slate-300 to-slate-400" :
              rank === 3 ? "from-orange-400 to-amber-700" : "from-slate-700 to-slate-800";
            return (
              <div
                key={`${row.name}-${i}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1.5 ${isMe ? "bg-orange-500/30 border border-orange-400/60" : "bg-white/5 border border-white/10"}`}
                data-testid={`leaderboard-row-${rank}`}
              >
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${medalColor} flex items-center justify-center font-mono-game font-bold text-slate-900 text-sm`}>
                  {rank <= 3 ? <Medal className="w-4 h-4" /> : rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate flex items-center gap-2">
                    {row.name}
                    {isMe && <span className="text-[10px] uppercase tracking-wider text-orange-300">You</span>}
                    {rank <= 3 && <Flame className="w-3.5 h-3.5 text-orange-400" />}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono-game font-bold text-amber-300">Lvl {row.level}</div>
                  <div className="font-mono-game text-xs text-slate-400">{row.score} pts</div>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const NameDialog = ({ open, onSave, draft, setDraft }) => (
  <Dialog open={open}>
    <DialogContent className="max-w-md bg-gradient-to-br from-amber-50 to-orange-100 border-0 shadow-2xl" data-testid="name-dialog">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
          <Medal className="w-6 h-6 text-amber-500" /> Pick your archer name
        </DialogTitle>
        <DialogDescription className="text-slate-600">
          This is the name shown on the global leaderboard. 2–16 characters. You can&apos;t change it later.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <Input
          placeholder="e.g. Robin"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={16}
          className="bg-white"
          data-testid="name-input"
        />
        <Button
          className="w-full bg-gradient-to-r from-orange-400 to-pink-500 text-white font-bold btn-press"
          disabled={(draft || "").trim().length < 2}
          onClick={() => onSave(draft)}
          data-testid="name-save-button"
        >
          Begin Adventure
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);
