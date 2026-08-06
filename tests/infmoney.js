// infmoney.js
// GEÇİCİ DEV PARA SİSTEMİ

const DEV_USERNAME = "KendiKullaniciAdin";
const DEV_MONEY = 999999999;

function applyInfMoney(player) {
    if (!player) return;

    // Sadece senin hesabında çalışır
    if (player.username === DEV_USERNAME) {
        player.money = DEV_MONEY;

        console.log(
            `[DEV] ${player.username} oyuna sınırsız para ile giriş yaptı.`
        );
    }
}

module.exports = { applyInfMoney };
