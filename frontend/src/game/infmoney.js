// Geçici geliştirici para sistemi
// Bu dosya kaldırıldığında sistem devre dışı kalır.

export const DEV_MONEY_ENABLED = true;
export const DEV_MONEY_AMOUNT = 999999;

export function applyDeveloperMoney(currentCoins) {
  if (!DEV_MONEY_ENABLED) {
    return currentCoins;
  }

  return Math.max(currentCoins, DEV_MONEY_AMOUNT);
}
