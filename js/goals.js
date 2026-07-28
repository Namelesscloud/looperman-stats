const $ = s => document.querySelector(s);
const fmt = n => Math.round(n ?? 0).toLocaleString("fr-FR");
const fmt1 = n => (n ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dFR = d => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/* ---------- Objectifs par défaut (modifiables dans l'UI) ---------- */
const DEFAULT_GOALS = [
  { id: 1, metric: "downloads",  target: 200000, label: "200 000 téléchargements", deadline: "2027-01-01" },
  { id: 2, metric: "downloads",  target: 250000, label: "250 000 téléchargements", deadline: "" },
  { id: 3, metric: "downloads",  target: 500000, label: "500 000 téléchargements", deadline: "" },
  { id: 4, metric: "downloads",  target: 1000000, label: "1 million de téléchargements", deadline: "" },
  { id: 5, metric: "uploads",    target: 300,    label: "300 loops publiés", deadline: "2027-06-01" },
  { id: 6, metric: "uploads",    target: 500,    label: "500 loops publiés", deadline: "" },
  { id: 7, metric: "favourites", target: 15000,  label: "15 000 favoris", deadline: "2026-12-31" },
  { id: 8, metric: "favourites", target: 25000,  label: "25 000 favoris", deadline: "" },
  { id: 9, metric: "comments",   target: 500,    label: "500 commentaires reçus", deadline: "" },
];

let H = [], LAST = null, RATES = {}, GOALS = [];

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
  const all = k => LAST[k] / totalDays;

  const win = days => {
    const cut = new Date(LAST.date); cut.setDate(cut.getDate() - days);
    const sub = H.filter(s => new Date(s.date) >= cut);
    if (sub.length < 2) return null;
    const span = Math.max(1, (new Date(sub.at(-1).date) - new Date(sub[0].date)) / 864e5);
    return k => (sub.at(-1)[k] - sub[0][k]) / span;
  };
  const w30 = win(30), w7 = win(7);

  ["downloads", "uploads", "favourites", "comments"].forEach(k => {
    RATES[k] = { all: all(k), d30: w30 ? w30(k) : all(k), d7: w7 ? w7(k) : (w30 ? w30(k) : all(k)) };
  });
}

/* ---------- Rythme affiché ---------- */
function renderPace() {
  const r = RATES.downloads;
  const items = [
    { l: "Rythme all-time",  v: r.all, x: "depuis l'inscription" },
    { l: "Rythme 30 jours",  v: r.d30, x: "référence de projection" },
    { l: "Rythme 7 jours",   v: r.d7,  x: "tendance courte" },
  ];
  $("#paceGrid").innerHTML = items.map(i => `
    <div class="vel">
      <span class="vel-l">${i.l}</span>
      <span class="vel-v">${fmt1(i.v)} <em>DL/j</em></span>
      <span class="vel-x">${i.x} · ≈ ${fmt(i.v * 30)}/mois</span>
    </div>`).join("");
}

/* ---------- Cartes objectifs ---------- */
function goalCard(g) {
  const cur = LAST[g.metric] ?? 0;
  const rate = RATES[g.metric]?.d30 || 0.0001;
  const pct = Math.min(100, (cur / g.target) * 100);
  const remain = g.target - cur;
  const done = remain <= 0;

  const daysNeeded = done ? 0 : remain / rate;
  const eta = new Date(LAST.date); eta.setDate(eta.getDate() + Math.ceil(daysNeeded));

  let dl = "", status = done ? "ok" : "run";
  if (g.deadline && !done) {
    const dLeft = Math.ceil((new Date(g.deadline) - new Date(LAST.date)) / 864e5);
    const need = dLeft > 0 ? remain / dLeft : Infinity;
    const onTrack = dLeft > 0 && need <= rate;
    status = onTrack ? "ok" : "late";
    dl = `<div class="g-dl ${onTrack ? "ok" : "late"}">
      Deadline ${dFR(g.deadline)} · ${dLeft > 0 ? dLeft + " j restants" : "dépassée"} ·
      requis <strong>${fmt1(need)}/j</strong> (actuel ${fmt1(rate)}/j)
      ${onTrack ? " ✓ dans les temps" : " ⚠ en retard"}
    </div>`;
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
    ${done ? "" : `<div class="g-eta">Estimation d'atteinte : <strong>${dFR(eta)}</strong> (~${Math.ceil(daysNeeded)} j / ${(daysNeeded / 30).toFixed(1)} mois)</div>`}
    ${dl}
  </div>`;
}

function renderGoals() {
  const by = m => GOALS.filter(g => g.metric === m)
    .sort((a, b) => a.target - b.target).map(goalCard).join("") || `<p class="muted">Aucun objectif.</p>`;
  $("#goalsDl").innerHTML = by("downloads");
  $("#goalsUp").innerHTML = by("uploads");
  $("#goalsFav").innerHTML = by("favourites") + by("comments");

  document.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    GOALS = GOALS.filter(g => g.id != b.dataset.del);
    saveGoals(); renderGoals(); renderTargets();
  });
}

/* ---------- Tableau des cadences requises ---------- */
function renderTargets() {
  const rows = GOALS.filter(g => LAST[g.metric] < g.target)
    .sort((a, b) => a.target - b.target).map(g => {
      const rate = RATES[g.metric].d30;
      const remain = g.target - LAST[g.metric];
      const dLeft = g.deadline ? Math.ceil((new Date(g.deadline) - new Date(LAST.date)) / 864e5) : null;
      const perDay = dLeft && dLeft > 0 ? remain / dLeft : remain / (365); // défaut : 1 an
      const gap = rate - perDay;
      const ok = gap >= 0;
      return `<tr>
        <td>${g.label}${dLeft ? `<br><span class="muted sm">→ ${dFR(g.deadline)}</span>` : `<br><span class="muted sm">→ horizon 12 mois</span>`}</td>
        <td class="strong">${fmt1(perDay)}</td>
        <td>${fmt1(perDay * 7)}</td>
        <td>${fmt1(perDay * 30)}</td>
        <td>${fmt1(rate)}</td>
        <td class="${ok ? "pos" : "neg"}">${ok ? "+" : ""}${fmt1(gap)}</td>
        <td><span class="pill ${ok ? "ok" : "late"}">${ok ? "Atteignable" : "À accélérer"}</span></td>
      </tr>`;
    }).join("");
  $("#targetTable tbody").innerHTML = rows || `<tr><td colspan="7" class="muted">Tous les objectifs sont atteints 🎉</td></tr>`;
}

/* ---------- Projection ---------- */
function renderProjection() {
  const r = RATES.downloads.d30;
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

  const goalLines = GOALS.filter(g => g.metric === "downloads" && g.target > LAST.downloads && g.target <= high.at(-1))
    .map((g, i) => ({
      label: g.label, data: labels.map(() => g.target),
      borderColor: ["#ffb347", "#ff6b6b", "#26d07c"][i % 3],
      borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5, fill: false
    }));

  new Chart($("#chartProj"), {
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
      plugins: { legend: { labels: { color: "#c9d1e0", usePointStyle: true, boxWidth: 8 } } },
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
  $("#addGoal").onclick = () => m.classList.add("open");
  $("#mCancel").onclick = () => m.classList.remove("open");
  m.onclick = e => { if (e.target === m) m.classList.remove("open"); };
  $("#mSave").onclick = () => {
    const t = +$("#mTarget").value;
    if (!t) return alert("Indique une valeur cible.");
    GOALS.push({
      id: Date.now(), metric: $("#mMetric").value, target: t,
      label: $("#mLabel").value || `${fmt(t)} ${$("#mMetric").selectedOptions[0].text.toLowerCase()}`,
      deadline: $("#mDeadline").value
    });
    saveGoals(); m.classList.remove("open");
    $("#mTarget").value = $("#mLabel").value = $("#mDeadline").value = "";
    renderGoals(); renderTargets();
  };
}

/* ---------- Init ---------- */
(async function () {
  const raw = await loadHistory();
  H = raw.slice().sort((a, b) => a.date.localeCompare(b.date));
  LAST = H.at(-1);
  GOALS = loadGoals();
  computeRates();
  renderPace(); renderGoals(); renderTargets(); renderProjection(); initModal();
})();