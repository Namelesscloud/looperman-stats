
---

## 📌 Commandes pour créer le repo

```bash
mkdir looperman-stats && cd looperman-stats
mkdir -p css js data scripts .github/workflows

# ... créer les fichiers avec le contenu ci-dessus ...

git init
git add .
git commit -m "feat: dashboard stats Looperman + objectifs + scraper auto"
git branch -M main
git remote add origin https://github.com/<Namelesscloud>/looperman-stats.git
git push -u origin main