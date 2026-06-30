export const SHOP_ITEMS = [
  {
    id: "bolt",
    name: "Bolt",
    icon: "⚡",
    price: 350,
    currency: "gold",
    rarity: "Rare",
    category: "Weapons",
    type: "consumable",
    effectType: "temporary_buff",
    durationSeconds: 10,
    description:
      "For 10 seconds, your arrows chain between balloons and hit multiple targets.",
    usable: true,
    consumable: true
  },
  {
    id: "health_potion",
    name: "Health Potion",
    icon: "🧪",
    price: 150,
    currency: "gold",
    rarity: "Common",
    category: "Consumables",
    type: "consumable",
    effectType: "heal",
    healAmount: 1,
    description:
      "Restores 1 extra health point.",
    usable: true,
    consumable: true
  },
  {
    id: "bomb_arrow",
    name: "Bomb Arrow",
    icon: "💣",
    price: 500,
    currency: "gold",
    rarity: "Epic",
    category: "Weapons",
    type: "consumable",
    effectType: "next_shot",
    description:
      "Your next arrow becomes an explosive bomb arrow. It sticks to a balloon and explodes in a large area with a BOOM effect.",
    usable: true,
    consumable: true
  },
  {
    id: "red_laser",
    name: "Red Laser",
    icon: "🔴",
    price: 800,
    currency: "gold",
    rarity: "Legendary",
    category: "Ultimate",
    type: "consumable",
    effectType: "instant_attack",
    description:
      "Fires a wide red laser beam. Normal targets are destroyed instantly. Level 10 bosses lose half of their health.",
    usable: true,
    consumable: true
  },
];

export function getShopItemById(id) {
  return SHOP_ITEMS.find((item) => item.id === id) || null;
}

export function getShopItemsByCategory(category) {
  return SHOP_ITEMS.filter((item) => item.category === category);
}

export function getShopItemsByRarity(rarity) {
  return SHOP_ITEMS.filter((item) => item.rarity === rarity);
