const DAILY_REWARD_KEY = "archerfall_daily_reward_v1";

export const FREE_REWARD_HOURS = 24;
export const PRO_REWARD_HOURS = 6;

export const REWARD_TRACK = [
  {
    day: 1,
    free: { coins: 30, items: [] },
    pro: { coins: 100, items: [] },
  },
  {
    day: 2,
    free: { coins: 30, items: [{ id: "shield", amount: 1 }] },
    pro: { coins: 120, items: [{ id: "shield", amount: 2 }] },
  },
  {
    day: 3,
    free: { coins: 40, items: [] },
    pro: { coins: 150, items: [{ id: "boom", amount: 1 }] },
  },
  {
    day: 4,
    free: { coins: 40, items: [{ id: "slowmo", amount: 1 }] },
    pro: { coins: 180, items: [{ id: "slowmo", amount: 2 }] },
  },
  {
    day: 5,
    free: { coins: 50, items: [] },
    pro: { coins: 220, items: [{ id: "shield", amount: 2 }] },
  },
  {
    day: 6,
    free: { coins: 60, items: [{ id: "boom", amount: 1 }] },
    pro: { coins: 250, items: [{ id: "boom", amount: 2 }] },
  },
  {
    day: 7,
    free: { coins: 100, items: [{ id: "chest", amount: 1 }] },
    pro: { coins: 400, items: [{ id: "legendary_chest", amount: 1 }] },
  },
];

export function getDailyRewardState(isPro = false) {
  const raw = localStorage.getItem(DAILY_REWARD_KEY);
  const saved = raw ? JSON.parse(raw) : null;

  const now = Date.now();
  const cooldownMs = (isPro ? PRO_REWARD_HOURS : FREE_REWARD_HOURS) * 60 * 60 * 1000;

  const lastClaimAt = saved?.lastClaimAt || 0;
  const currentDay = saved?.currentDay || 1;
  const nextClaimAt = lastClaimAt + cooldownMs;
  const canClaim = !lastClaimAt || now >= nextClaimAt;

  return {
    canClaim,
    currentDay,
    nextClaimAt,
    remainingMs: canClaim ? 0 : nextClaimAt - now,
    reward: REWARD_TRACK[currentDay - 1],
  };
}

export function claimDailyReward(isPro = false) {
  const state = getDailyRewardState(isPro);

  if (!state.canClaim) {
    return {
      ok: false,
      reason: "cooldown",
      remainingMs: state.remainingMs,
    };
  }

  const reward = isPro ? state.reward.pro : state.reward.free;
  const nextDay = state.currentDay >= 7 ? 1 : state.currentDay + 1;

  localStorage.setItem(
    DAILY_REWARD_KEY,
    JSON.stringify({
      lastClaimAt: Date.now(),
      currentDay: nextDay,
    })
  );

  return {
    ok: true,
    day: state.currentDay,
    reward,
    nextDay,
  };
}

export function formatRemainingTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${minutes}m ${seconds}s`;
}
free: { coins: 30, items: [{ id: "bolt", amount: 1 }] }
pro: { coins: 120, items: [{ id: "bomb", amount: 1 }] }
