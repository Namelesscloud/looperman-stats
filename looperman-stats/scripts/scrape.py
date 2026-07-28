#!/usr/bin/env python3
"""
Scraper Looperman -> data/history.json
Ajoute (ou met à jour) le snapshot du jour.

Usage :
    python scripts/scrape.py
    python scripts/scrape.py --user 4055719
"""

import argparse, json, re, sys, unicodedata
from datetime import date
from pathlib import Path

import requests
from bs4 import BeautifulSoup

DEFAULT_USER = 4055719
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "history.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

# libellé Looperman -> clé JSON
FIELDS = {
    "loops uploaded":  "uploads",
    "tracks uploaded": "tracksUploaded",
    "loops downloaded": "downloaded",     # loops QU'IL a téléchargés
    "tracks played":   "tracksPlayed",
    "downloads":       "downloads",       # SES loops téléchargés par d'autres
    "favourites in":   "favourites",
    "favorites in":    "favourites",
    "favourites out":  "favouritesOut",
    "favorites out":   "favouritesOut",
    "comments in":     "comments",
    "comments out":    "commentsOut",
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().lower().rstrip(":")


def to_int(s: str):
    m = re.search(r"-?[\d,\.\s]*\d", s)
    if not m:
        return None
    try:
        return int(re.sub(r"[^\d]", "", m.group()))
    except ValueError:
        return None


def scrape(user_id: int) -> dict:
    url = f"https://www.looperman.com/users/profile/{user_id}"
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    stats = {}

    # 1) Tables / listes de définitions
    for tr in soup.find_all("tr"):
        tds = tr.find_all(["td", "th"])
        if len(tds) >= 2:
            k = norm(tds[0].get_text())
            if k in FIELDS:
                v = to_int(tds[1].get_text())
                if v is not None:
                    stats[FIELDS[k]] = v

    for dl in soup.find_all("dl"):
        dts, dds = dl.find_all("dt"), dl.find_all("dd")
        for dt, dd in zip(dts, dds):
            k = norm(dt.get_text())
            if k in FIELDS:
                v = to_int(dd.get_text())
                if v is not None:
                    stats[FIELDS[k]] = v

    # 2) Fallback : regex sur le texte brut
    text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))
    for label, key in FIELDS.items():
        if key in stats:
            continue
        m = re.search(re.escape(label) + r"\s*:?\s*([\d,\.]+)", text, re.I)
        if m:
            v = to_int(m.group(1))
            if v is not None:
                stats[key] = v

    if "downloads" not in stats:
        raise RuntimeError(
            "Impossible de trouver 'Downloads'. Le HTML de Looperman a peut-être changé.\n"
            f"Clés récupérées : {sorted(stats)}"
        )

    stats["date"] = date.today().isoformat()
    return stats


def merge(new: dict):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    hist = []
    if OUT.exists():
        try:
            hist = json.loads(OUT.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print("⚠  history.json illisible, réinitialisation.", file=sys.stderr)

    hist = [h for h in hist if h.get("date") != new["date"]]
    hist.append(new)
    hist.sort(key=lambda h: h["date"])

    OUT.write_text(json.dumps(hist, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return hist


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", type=int, default=DEFAULT_USER)
    args = ap.parse_args()

    snap = scrape(args.user)
    hist = merge(snap)

    print("✔ Snapshot enregistré :")
    for k in ("date", "uploads", "downloads", "favourites", "comments", "downloaded", "tracksPlayed"):
        if k in snap:
            print(f"   {k:<14} {snap[k]}")

    if len(hist) >= 2:
        prev, cur = hist[-2], hist[-1]
        d = cur["downloads"] - prev["downloads"]
        print(f"\n   Δ downloads depuis {prev['date']} : {d:+,}")
    print(f"\n→ {len(hist)} snapshot(s) dans {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()