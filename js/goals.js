/* ============================================================
   LOOPERMAN GOALS — Namelessprod
   Dépend de : js/data.js (loadHistory, PROFILE)
   ============================================================ */

const $ = s => document.querySelector(s);
const fmt = n => Math.round(n ?? 0).toLocaleString("fr-FR");
const fmt1 = n => (n ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dFR = d => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/* Plafond de projection : au-delà, on considère l'objectif hors d'atteinte */
const MAX_PROJECTION_DAYS = 365 * 50;

/* ---------- Objectifs par défaut (modifiables dans l'UI) ---------- */
const DEFAULT_GOALS = [
  { id: 1, metric: "downloads",  target: 200000,  label: "200 000 téléchargements", deadline: "2027-01-01" },
  { id: 2, metric: "downloads",  target: 250000,  label: "250 000 téléchargements", deadline: "" },
  { id: 3, metric: "downloads",  target: 500000,  label: "500 000 téléchargements", deadline: "" },
  { id: 4, metric: "downloads",  target: 1000000, label: "1 million de téléchargements", deadline: "" },
  { id: 5, metric: "uploads",    target: 300,     label: "300 loops publiés", deadline: "2027-06-01" },
  { id: 6, metric: "uploads",    target: 500,     label: "500 loops publiés", deadline: "" },
  { id: 7, metric: "favourites", target: 15000,   label: "15 000 favoris", deadline: "2026-12-31" },
  { id: 8, metric: "favourites", target: 25000,   label: "25 000 favoris", deadline: "" },
  { id: 9, metric: "comments",   target: 500,     label: "500 commentaires reçus", deadline: "" },
];

let H = [], LAST = null, RATES = {}, GOALS = [];
let RATE_SOURCE = "d30";   // "d30" = fenêtre réelle · "all" = fallback all-time
let projChart = null;

function loadGoals() {
  try {
    const g = JSON.parse(localStorage.getItem("lm_goals"));
    if (Array.isArray(g) && g.length) return g;
  } catch (e) {}
  return DEFAULT_GOALS;
}
const saveGoals = () => localStorage.setItem("lm_goals", JSON.stringify(GOALS));

/* ---------- Calcul des rythmes réels ---------- */
function computeRates() {
  const totalDays = Math.max(1, (new Date(LAST.date) - new Date(PROFILE.joined)) / 864e5);
  const all = k => (LAST[k] ?? 0) / totalDays;

  const win = days => {
    const cut = new Date(LAST.date); cut.setDate(cut.getDate() - days);
    const sub = H.filter(s => new Date(s.date) >= cut);
    if (sub.length < 2) return null;
    const span = Math.max(1, (new Date(sub.at(-1).date) - new Date(sub[0].date)) / 864e5);
    return k => ((sub.at(-1)[k] ?? 0) - (sub[0][k] ?? 0)) / span;
  };
  const w30 = win(30), w7 = win(7);

  // Indique si la projection s'appuie sur une vraie fenêtre ou sur l'all-time
  RATE_SOURCE = w30 ? "d30" : "all";

  ["downloads", "uploads", "favourites", "comments"].forEach(k => {
    RATES[k] = {
      all: all(k),
      d30: w30 ? w30(k) : all(k),
      d7:  w7 ? w7(k) : (w30 ? w30(k) : all(k))
    };
  });
}

/* Rythme de référence, jamais négatif ni nul de façon dangereuse */
function refRate(metric) {
  const r = RATES[metric]?.d30 ?? 0;
  return r > 0 ? r : 0;
}

/* ---------- Rythme affiché ---------- */
function renderPace() {
  const r = RATES.downloads;
  const fallback = RATE_SOURCE === "all";

  const items = [
    { l: "Rythme all-time", v: r.all, x: "depuis l'inscription" },
    { l: "Rythme 30 jours", v: r.d30, x: fallback ? "⚠ estimé sur l'all-time" : "référence de projection" },
    { l: "Rythme 7 jours",  v: r.d7,  x: fallback ? "⚠ estimé sur l'all-time" : "tendance courte" },
  ];

  $("#paceGrid").innerHTML = items.map(i => `
    <div class="vel">
      <span class="vel-l">${i.l}</span>
      <span class="vel-v">${fmt1(i.v)} <em>DL/j</em></span>
      <span class="vel-x">${i.x} · ≈ ${fmt(i.v * 30)}/mois</span>
    </div>`).join("");

  if (fallback && $("#paceNote")) {
    $("#paceNote").innerHTML = `<span class="muted sm">
      Un seul relevé disponible : les rythmes 7 j et 30 j reprennent la moyenne all-time.
      Les projections se préciseront après quelques jours de collecte.</span>`;
  }
}

/* ---------- Cartes objectifs ---------- */
function goalCard(g) {
  const cur = LAST[g.metric] ?? 0;
  const rate = refRate(g.metric);
  const pct = g.target > 0 ? Math.min(100, (cur / g.target) * 100) : 0;
  const remain = g.target - cur;
  const done = remain <= 0;

  // Projection d'atteinte
  let etaBlock = "";
  if (!done) {
    if (rate <= 0) {
      etaBlock = `<div class="g-eta muted">Estimation impossible : rythme actuel nul ou inconnu.</div>`;
    } else {
      const daysNeeded = remain / rate;
      if (daysNeeded > MAX_PROJECTION_DAYS) {
        etaBlock = `<div class="g-eta muted">Au rythme actuel (${fmt1(rate)}/j), objectif hors horizon prévisible.</div>`;
      } else {
        const eta = new Date(LAST.date);
        eta.setDate(eta.getDate() + Math.ceil(daysNeeded));
        etaBlock = `<div class="g-eta">Estimation d'atteinte : <strong>${dFR(eta)}</strong>
          (~${fmt(Math.ceil(daysNeeded))} j / ${(daysNeeded / 30.44).toFixed(1)} mois)</div>`;
      }
    }
  }

  // Bloc deadline
  let dl = "", status = done ? "ok" : "run";
  if (g.deadline && !done) {
    const dLeft = Math.ceil((new Date(g.deadline) - new Date(LAST.date)) / 864e5);
    if (dLeft > 0) {
      const need = remain / dLeft;
      const onTrack = rate > 0 && need <= rate;
      status = onTrack ? "ok" : "late";
      dl = `<div class="g-dl ${onTrack ? "ok" : "late"}">
        Deadline ${dFR(g.deadline)} · ${dLeft} j restants ·
        requis <strong>${fmt1(need)}/j</strong> (actuel ${fmt1(rate)}/j)
        ${onTrack ? " ✓ dans les temps" : " ⚠ en retard"}
      </div>`;
    } else {
      status = "late";
      dl = `<div class="g-dl late">
        Deadline ${dFR(g.deadline)} · <strong>dépassée</strong> ·
        reste ${fmt(remain)} au rythme de ${fmt1(rate)}/j
      </div>`;
    }
  }

  return `<div class="goal ${status}">
    <div class="g-top">
      <span class="g-label">${g.label}</span>
      <span class="g-pct">${pct.toFixed(1)} %</span>
      <button class="g-del" data-del="${g.id}" title="Supprimer">✕</button>
    </div>
    <div class="g-bar"><i style="width:${pct}%"></i></div>
    <div class="g-nums">
      <span>${fmt(cur)} / ${fmt(g.target)}</span>
      <span>${done ? "🎉 Atteint !" : `reste ${fmt(remain)}`}</span>
    </div>
    ${etaBlock}
    ${dl}
  </div>`;
}

function renderGoals() {
  const by = m => GOALS.filter(g => g.metric === m)
    .sort((a, b) => a.target - b.target).map(goalCard).join("");

  $("#goalsDl").innerHTML  = by("downloads")  || `<p class="muted">Aucun objectif.</p>`;
  $("#goalsUp").innerHTML  = by("uploads")    || `<p class="muted">Aucun objectif.</p>`;
  $("#goalsFav").innerHTML = (by("favourites") + by("comments")) || `<p class="muted">Aucun objectif.</p>`;

  document.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    GOALS = GOALS.filter(g => g.id != b.dataset.del);
    saveGoals(); renderGoals(); renderTargets(); renderProjection();
  });
}

/* ---------- Tableau des cadences requises ---------- */
function renderTargets() {
  const rows = GOALS
    .filter(g => (LAST[g.metric] ?? 0) < g.target)
    .sort((a, b) => a.target - b.target)
    .map(g => {
      const rate = refRate(g.metric);
      const remain = g.target - (LAST[g.metric] ?? 0);
      const dLeftRaw = g.deadline
        ? Math.ceil((new Date(g.deadline) - new Date(LAST.date)) / 864e5)
        : null;
      const hasDeadline = dLeftRaw !== null && dLeftRaw > 0;
      const horizon = hasDeadline ? dLeftRaw : 365;
      const perDay = remain / horizon;
      const gap = rate - perDay;
      const ok = gap >= 0;

      const sub = dLeftRaw === null
        ? `→ horizon 12 mois`
        : dLeftRaw > 0
          ? `→ ${dFR(g.deadline)}`
          : `→ ${dFR(g.deadline)} (dépassée)`;

      return `<tr>
        <td>${g.label}<br><span class="muted sm">${sub}</span></td>
        <td class="strong">${fmt1(perDay)}</td>
        <td>${fmt1(perDay * 7)}</td>
        <td>${fmt1(perDay * 30.44)}</td>
        <td>${fmt1(rate)}</td>
        <td class="${ok ? "pos" : "neg"}">${ok ? "+" : ""}${fmt1(gap)}</td>
        <td><span class="pill ${ok ? "ok" : "late"}">${ok ? "Atteignable" : "À accélérer"}</span></td>
      </tr>`;
    }).join("");

  $("#targetTable tbody").innerHTML = rows
    || `<tr><td colspan="7" class="muted">Tous les objectifs sont atteints 🎉</td></tr>`;
}

/* ---------- Projection ---------- */
function renderProjection() {
  const r = refRate("downloads");
  const labels = [], base = [], low = [], high = [];
  const start = new Date(LAST.date);

  for (let m = 0; m <= 12; m++) {
    const d = new Date(start); d.setMonth(d.getMonth() + m);
    labels.push(d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }));
    const days = m * 30.44;
    base.push(Math.round(LAST.downloads + r * days));
    low.push(Math.round(LAST.downloads + r * 0.75 * days));
    high.push(Math.round(LAST.downloads + r * 1.25 * days));
  }

  const goalLines = GOALS
    .filter(g => g.metric === "downloads" && g.target > LAST.downloads && g.target <= high.at(-1))
    .map((g, i) => ({
      label: g.label,
      data: labels.map(() => g.target),
      borderColor: ["#ffb347", "#ff6b6b", "#26d07c"][i % 3],
      borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5, fill: false
    }));

  projChart?.destroy();
  projChart = new Chart($("#chartProj"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Optimiste (+25 %)", data: high, borderColor: "rgba(79,140,255,.35)", backgroundColor: "rgba(79,140,255,.10)", fill: "+1", tension: .3, pointRadius: 0 },
        { label: "Projection", data: base, borderColor: "#4f8cff", backgroundColor: "rgba(79,140,255,.10)", fill: "+1", tension: .3, pointRadius: 3, borderWidth: 2.5 },
        { label: "Pessimiste (−25 %)", data: low, borderColor: "rgba(79,140,255,.35)", tension: .3, pointRadius: 0 },
        ...goalLines
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#c9d1e0", usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: { label: c => `${c.dataset.label} : ${fmt(c.parsed.y)} DL` } }
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,.07)" }, ticks: { color: "#8b93a7" } },
        y: { grid: { color: "rgba(255,255,255,.07)" }, ticks: { color: "#8b93a7", callback: v => (v / 1000) + "K" } }
      }
    }
  });
}

/* ---------- Modal ---------- */
function initModal() {
  const m = $("#modal");
  if (!m) return;

  $("#addGoal").onclick = () => m.classList.add("open");
  $("#mCancel").onclick = () => m.classList.remove("open");
  m.onclick = e => { if (e.target === m) m.classList.remove("open"); };

  $("#mSave").onclick = () => {
    const t = +$("#mTarget").value;
    if (!t || t <= 0) return alert("Indique une valeur cible valide.");

    const metric = $("#mMetric").value;
    const cur = LAST[metric] ?? 0;
    if (t <= cur) {
      if (!confirm(`Tu as déjà ${fmt(cur)} ${metric}. Créer quand même cet objectif ?`)) return;
    }

    GOALS.push({
      id: Date.now(),
      metric,
      target: t,
      label: $("#mLabel").value.trim() || `${fmt(t)} ${$("#mMetric").selectedOptions[0].text.toLowerCase()}`,
      deadline: $("#mDeadline").value
    });

    saveGoals();
    m.classList.remove("open");
    $("#mTarget").value = $("#mLabel").value = $("#mDeadline").value = "";
    renderGoals(); renderTargets(); renderProjection();
  };
}

/* ---------- Init ---------- */
(async function () {
  const raw = await loadHistory();
  H = raw.slice().sort((a, b) => a.date.localeCompare(b.date));

  if (!H.length) {
    $("#paceGrid").innerHTML = `<p class="muted">Aucune donnée disponible.</p>`;
    return;
  }

  LAST = H.at(-1);
  GOALS = loadGoals();

  computeRates();
  renderPace();
  renderGoals();
  renderTargets();
  renderProjection();
  initModal();
})();
