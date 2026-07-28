#!/usr/bin/env python3
"""
Scraper des statistiques Looperman
Récupère les Loop Stats du profil et les ajoute à data/history.json
"""

import re
import json
import os
import sys
from datetime import date

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------- Configuration

URL = "https://www.looperman.com/users/profile/4055719"
HISTORY_FILE = "data/history.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

LABELS = [
    "Uploads",
    "Downloads",
    "Downloaded",
    "Favourites In",
    "Favourites Out",
    "Comments in",
    "Comments out",
]

# ---------------------------------------------------------------- Récupération

def recuperer_html(url):
    """Télécharge la page de profil."""
    reponse = requests.get(url, headers=HEADERS, timeout=30)
    reponse.raise_for_status()
    return reponse.text


def isoler_bloc_loop_stats(html):
    """
    Extrait uniquement la portion de texte correspondant au bloc 'Loop Stats',
    afin d'ignorer les blocs 'Acapella Stats' et 'Track Stats'.
    """
    soup = BeautifulSoup(html, "html.parser")
    texte = soup.get_text(" ", strip=True)

    debut = texte.find("Loop Stats")
    if debut == -1:
        raise ValueError("Bloc 'Loop Stats' introuvable dans la page.")

    fin = texte.find("Acapella Stats", debut)
    if fin == -1:
        # Pas de bloc suivant : on prend une fenêtre raisonnable
        fin = debut + 2000

    return texte[debut:fin]


# ---------------------------------------------------------------- Extraction

def extraire_paires(bloc):
    """
    Capture toutes les paires (nombre, label) du bloc en une seule passe.
    Les labels apparaissant dans l'ordre exact des tuiles, il n'y a
    aucune ambiguïté entre 'Downloads' / 'Downloaded'
    ni entre 'Favourites In' / 'Favourites Out'.
    """
    motif = r"([\d,]+)\s+(" + "|".join(re.escape(l) for l in LABELS) + r")"
    paires = re.findall(motif, bloc)
    return {label: int(n.replace(",", "")) for n, label in paires}


def lire(bloc, label):
    """
    Filet de sécurité : recherche isolée d'un label si l'extraction
    globale n'a rien trouvé pour celui-ci.
    """
    m = re.search(r"([\d,]+)\s*" + re.escape(label) + r"\b", bloc)
    return int(m.group(1).replace(",", "")) if m else 0


def construire_stats(bloc):
    """Assemble le dictionnaire de statistiques du jour."""
    brut = extraire_paires(bloc)

    def valeur(label):
        return brut.get(label) if label in brut else lire(bloc, label)

    return {
        "date":           str(date.today()),
        "uploads":        valeur("Uploads"),
        "downloads":      valeur("Downloads"),
        "downloaded":     valeur("Downloaded"),
        "favouritesIn":   valeur("Favourites In"),
        "favouritesOut":  valeur("Favourites Out"),
        "commentsIn":     valeur("Comments in"),
        "commentsOut":    valeur("Comments out"),
    }


# ---------------------------------------------------------------- Historique

def charger_historique(chemin):
    """Lit l'historique existant, ou retourne une liste vide."""
    if not os.path.exists(chemin):
        return []
    try:
        with open(chemin, "r", encoding="utf-8") as f:
            contenu = f.read().strip()
            return json.loads(contenu) if contenu else []
    except (json.JSONDecodeError, OSError):
        print("⚠️  Historique illisible, réinitialisation.")
        return []


def fusionner(historique, stats):
    """
    Ajoute l'entrée du jour, ou remplace celle existante
    si le scraper tourne plusieurs fois dans la même journée.
    """
    historique = [e for e in historique if e.get("date") != stats["date"]]
    historique.append(stats)
    historique.sort(key=lambda e: e["date"])
    return historique


def sauvegarder(chemin, historique):
    """Écrit l'historique sur disque."""
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(historique, f, indent=2, ensure_ascii=False)
        f.write("\n")


# ---------------------------------------------------------------- Point d'entrée

def main():
    print(f"→ Récupération de {URL}")
    html = recuperer_html(URL)

    print("→ Isolation du bloc Loop Stats")
    bloc = isoler_bloc_loop_stats(html)

    print("→ Extraction des statistiques")
    stats = construire_stats(bloc)

    for cle, val in stats.items():
        if cle != "date":
            print(f"   {cle:<16} {val:>10,}")

    if stats["downloads"] == 0 and stats["uploads"] == 0:
        print("\n❌ Toutes les valeurs principales sont à zéro.")
        print("   La structure de la page a peut-être changé.")
        print(f"   Extrait du bloc analysé :\n{bloc[:400]}")
        sys.exit(1)

    print(f"\n→ Mise à jour de {HISTORY_FILE}")
    historique = charger_historique(HISTORY_FILE)
    historique = fusionner(historique, stats)
    sauvegarder(HISTORY_FILE, historique)

    print(f"✅ Terminé — {len(historique)} entrée(s) dans l'historique.")


if __name__ == "__main__":
    main()
