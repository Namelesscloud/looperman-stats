/* ============================================================
   HISTORIQUE DES STATS LOOPERMAN
   Source principale : data/history.json (rempli par GitHub Actions)
   Fallback : LOOPERMAN_HISTORY ci-dessous

   Champs normalisés en interne :
     date, uploads, downloads, downloaded,
     favourites, favouritesOut, comments, commentsOut, tracksPlayed
   ============================================================ */

const LOOPERMAN_HISTORY = [
  { date: "2026-07-28", uploads: 254, downloads: 174939, favourites: 13502, comments: 271, downloaded: 14, tracksPlayed: 19 },
];

const PROFILE = {
  name: "Namelessprod",
  userId: 4055719,
  joined: "2020-05-04",
  url: "https://www.looperman.com/users/profile/4055719"
};

/* ------------------------------------------------------------
   Normalisation d'un snapshot
   Accepte les anciens noms (favourites, comments) et les
   nouveaux issus du scraper (favouritesIn, commentsIn).
   ------------------------------------------------------------ */
function normalizeSnapshot(s) {
  const num = (v) => {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "number") return v;
    return parseInt(String(v).replace(/[^\d-]/g, ""), 10) || 0;
  };

  const pick = (...keys) => {
    for (const k of keys) {
      if (s[k] !== undefined && s[k] !== null) return s[k];
    }
    return 0;
  };

  return {
    date:          s.date,
    uploads:       num(pick("uploads")),
    downloads:     num(pick("downloads")),
    downloaded:    num(pick("downloaded")),
    favourites:    num(pick("favouritesIn", "favourites", "favoritesIn", "favorites")),
    favouritesOut: num(pick("favouritesOut", "favoritesOut")),
    comments:      num(pick("commentsIn", "comments")),
    commentsOut:   num(pick("commentsOut")),
    tracksPlayed:  num(pick("tracksPlayed", "tracks_played"))
  };
}

/* ------------------------------------------------------------
   Chargement + nettoyage de l'historique
   ------------------------------------------------------------ */
async function loadHistory() {
  let raw = null;

  try {
    const r = await fetch("data/history.json", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j) && j.length) raw = j;
    }
  } catch (e) {
    /* fallback silencieux */
  }

  if (!raw) raw = LOOPERMAN_HISTORY;

  // Normalise, écarte les entrées sans date, déduplique, trie
  const seen = new Map();
  raw
    .map(normalizeSnapshot)
    .filter(s => s.date)
    .forEach(s => seen.set(s.date, s));   // la dernière occurrence gagne

  return Array.from(seen.values())
    .sort((a, b) => a.date.localeCompare(b.date));
}
