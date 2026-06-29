// Shop catalog + persistence helpers.
import { Crown, Gem, Sparkles, Zap, Eye, Heart, Clover } from "lucide-react";

export const BOWS = {
  wooden: {
    id: "wooden",
    name: "Wooden Bow",
    desc: "The classic. Reliable, balanced.",
    cost: 0,
    arrowCount: 1,
    scoreMult: 1,
    arrowSpeedMult: 1,
    color: "#7a4a2a",
    accent: "#3a2418",
    icon: Crown,
    rarity: "Common",
  },
  emerald: {
    id: "emerald",
    name: "Emerald Bow",
    desc: "Fires 2 arrows in a tight spread.",
    cost: 250,
    arrowCount: 2,
    scoreMult: 1,
    arrowSpeedMult: 1,
    color: "#10b981",
    accent: "#065f46",
    icon: Gem,
    rarity: "Rare",
  },
  amethyst: {
    id: "amethyst",
    name: "Amethyst Bow",
    desc: "Three-arrow spread on every shot.",
    cost: 600,
    arrowCount: 3,
    scoreMult: 1,
    arrowSpeedMult: 1,
    color: "#a855f7",
    accent: "#581c87",
    icon: Sparkles,
    rarity: "Epic",
  },
  diamond: {
    id: "diamond",
    name: "Diamond Bow",
    desc: "Faster arrows + 1.5x score per hit.",
    cost: 1200,
    arrowCount: 1,
    scoreMult: 1.5,
    arrowSpeedMult: 1.35,
    color: "#67e8f9",
    accent: "#0891b2",
    icon: Gem,
    rarity: "Legendary",
  },
};

export const ITEMS = {
  quickDraw: {
    id: "quickDraw",
    name: "Quick Draw Gloves",
    desc: "Charge your bow 40% faster.",
    cost: 200,
    icon: Zap,
    color: "from-amber-400 to-orange-500",
  },
  eagleEye: {
    id: "eagleEye",
    name: "Eagle Eye",
    desc: "Arrows fly 25% faster & farther.",
    cost: 300,
    icon: Eye,
    color: "from-sky-400 to-blue-600",
  },
  luckyCharm: {
    id: "luckyCharm",
    name: "Lucky Charm",
    desc: "+70% power-up drop chance.",
    cost: 450,
    icon: Clover,
    color: "from-emerald-400 to-green-600",
  },
  extraLife: {
    id: "extraLife",
    name: "Extra Heart",
    desc: "Start each run with 4 lives.",
    cost: 400,
    icon: Heart,
    color: "from-rose-400 to-pink-600",
  },
};

const COINS_KEY = "archery_coins_v1";
const OWNED_BOWS_KEY = "archery_owned_bows_v1";
const OWNED_ITEMS_KEY = "archery_owned_items_v1";
const EQUIPPED_BOW_KEY = "archery_equipped_bow_v1";

export const loadProgress = () => {
  const coins = parseInt(localStorage.getItem(COINS_KEY) || "0", 10);
  const ownedBows = JSON.parse(localStorage.getItem(OWNED_BOWS_KEY) || '["wooden"]');
  const ownedItems = JSON.parse(localStorage.getItem(OWNED_ITEMS_KEY) || "[]");
  const equippedBow = localStorage.getItem(EQUIPPED_BOW_KEY) || "wooden";
  return { coins, ownedBows, ownedItems, equippedBow };
};

export const saveProgress = ({ coins, ownedBows, ownedItems, equippedBow }) => {
  localStorage.setItem(COINS_KEY, String(coins));
  localStorage.setItem(OWNED_BOWS_KEY, JSON.stringify(ownedBows));
  localStorage.setItem(OWNED_ITEMS_KEY, JSON.stringify(ownedItems));
  localStorage.setItem(EQUIPPED_BOW_KEY, equippedBow);
};

export const getThemeForLevel = (level) => {
  // 1-2: day, 3-4: sunset, 5-6: night, then repeats every 6
  const cycle = ((level - 1) % 6) + 1;
  if (cycle <= 2) return "day";
  if (cycle <= 4) return "sunset";
  return "night";
};
