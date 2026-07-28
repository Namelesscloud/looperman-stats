# 📊 Looperman Stats Dashboard — Namelessprod

Dashboard web pour suivre les statistiques du profil Looperman
[Namelessprod (#4055719)](https://www.looperman.com/users/profile/4055719) :
uploads, téléchargements, favoris et commentaires, avec moyennes
quotidiennes / hebdomadaires / mensuelles, projections et suivi d'objectifs.

## ✨ Fonctionnalités

**Page 1 — Dashboard**
- 6 cartes KPI avec variation depuis le dernier relevé
- Vélocité des téléchargements : moyennes 7 / 14 / 30 / 90 / 365 jours + tendance
- Graphique cumulé (30 j / 90 j / 1 an / tout) — downloads, favoris, uploads
- Histogramme des téléchargements par jour (60 derniers jours)
- Moyennes par semaine ISO et par mois
- Tableau détaillé commutable jour / semaine / mois + export CSV

**Page 2 — Objectifs**
- Rythme actuel (all-time / 30 j / 7 j)
- Barres de progression par objectif avec **date d'atteinte estimée**
- Gestion des deadlines : cadence requise vs cadence réelle, statut « dans les temps » / « en retard »
- Projection 12 mois avec fourchette pessimiste / optimiste et lignes de paliers
- Tableau des cadences requises par jour / semaine / mois
- Ajout / suppression d'objectifs (sauvegarde `localStorage`)

## 🚀 Installation

```bash
git clone https://github.com/<ton-user>/looperman-stats.git
cd looperman-stats