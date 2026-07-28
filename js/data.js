/* ============================================================
   HISTORIQUE DES STATS LOOPERMAN
   Ajoute une ligne par jour (ou laisse GitHub Actions le faire).
   Champs : date (YYYY-MM-DD), uploads, downloads, favourites,
            comments, downloaded, tracksPlayed
   ============================================================ */

const LOOPERMAN_HISTORY = [
  { date: "2026-07-28", uploads: 254, downloads: 174939, favourites: 13502, comments: 271, downloaded: 14, tracksPlayed: 19 },

  // 👇 Ajoute tes nouvelles lignes ici, ordre chronologique
  // { date: "2026-07-29", uploads: 254, downloads: 175120, favourites: 13515, comments: 272, downloaded: 14, tracksPlayed: 19 },
];

const PROFILE = {
  name: "Namelessprod",
  userId: 4055719,
  joined: "2020-05-04",
  url: "https://www.looperman.com/users/profile/4055719"
};

/* Tentative de chargement de data/history.json (si scraping actif) */
async function loadHistory() {
  try {
    const r = await fetch("data/history.json", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j) && j.length) return j;
    }
  } catch (e) { /* fallback silencieux */ }
  return LOOPERMAN_HISTORY;
}