import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const COIN_PACKS = [
  { id: "starter", coins: 200, price: 1,  label: "Starter Quiver",   tagline: "Quick refill" },
  { id: "archer",  coins: 1100, price: 5,  label: "Archer's Bundle",  tagline: "Most popular", popular: true },
  { id: "ranger",  coins: 2500, price: 10, label: "Ranger's Stash",   tagline: "Best value", best: true },
  { id: "legend",  coins: 6000, price: 20, label: "Legend's Hoard",   tagline: "Huge boost" },
];

export const SUPPORT_TIERS = [
  { id: "tip_1",  amount: 1,  label: "Coffee crumbs",   emoji: "☕" },
  { id: "tip_3",  amount: 3,  label: "Friendly tip",    emoji: "🎯" },
  { id: "tip_5",  amount: 5,  label: "Nice shot",       emoji: "🏹" },
  { id: "tip_10", amount: 10, label: "Big supporter",   emoji: "🔥" },
  { id: "tip_25", amount: 25, label: "Hero tier",       emoji: "👑" },
  { id: "tip_50", amount: 50, label: "Legendary patron",emoji: "🐉" },
];

export const startCoinCheckout = async (packageId, playerName) => {
  const origin_url = window.location.origin;
  const { data } = await axios.post(`${API}/payments/coins/checkout`, {
    package_id: packageId, origin_url, player_name: playerName,
  });
  return data; // { url, session_id }
};

export const startSupportCheckout = async ({ tierId, customAmount, message }) => {
  const origin_url = window.location.origin;
  const payload = { origin_url };
  if (tierId) payload.tier_id = tierId;
  if (customAmount != null) payload.custom_amount = customAmount;
  if (message) payload.message = message;
  const { data } = await axios.post(`${API}/payments/support/checkout`, payload);
  return data;
};

export const getCheckoutStatus = async (sessionId) => {
  const { data } = await axios.get(`${API}/payments/checkout/status/${sessionId}`);
  return data;
};

export const pollCheckout = async (sessionId, { interval = 1500, maxAttempts = 10 } = {}) => {
  for (let i = 0; i < maxAttempts; i++) {
    const s = await getCheckoutStatus(sessionId);
    if (s.payment_status === "paid") return { ok: true, ...s };
    if (s.status === "expired") return { ok: false, status: "expired" };
    await new Promise((r) => setTimeout(r, interval));
  }
  return { ok: false, status: "timeout" };
};
