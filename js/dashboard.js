/* ============================ UTILS ============================ */
const $ = s => document.querySelector(s);
const fmt = n => (n ?? 0).toLocaleString("fr-FR");
const fmt1 = n => (n ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const daysBetween = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 864e5));
const dFR = d => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

let H = [];          // historique trié
let charts = {};

/* Δ par snapshot + moyenne/jour interpolée */
function buildDeltas(hist) {
  return hist.map((s, i) => {
    if (i === 0) return { ...s, dDl: 0, dFav: 0, dCom: 0, dUp: 0, span: 1, dlDay: 0 };
    const p = hist[i - 1];
    const span = daysBetween(p.date, s.date);
    const dDl = s.downloads - p.downloads;
    return {
      ...s,
      dDl, dFav: s.favourites - p.favourites,
      dCom: s.comments - p.comments,
      dUp: s.uploads - p.uploads,
      span, dlDay: dDl / span
    };
  });
}

/* Série journalière lissée (répartit les Δ sur les jours manquants) */
function dailySeries(hist) {
  const out = [];
  for (let i = 1; i < hist.length; i++) {
    const p = hist[i - 1], c = hist[i];
    const span = daysBetween(p.date, c.date);
    const per = (c.downloads - p.downloads) / span;
    const perF = (c.favourites - p.favourites) / span;
    for (let k = 1; k <= span; k++) {
      const d = new Date(p.date); d.setDate(d.getDate() + k);
      out.push({ date: d.toISOString().slice(0, 10), dl: per, fav: perF });
    }
  }
  return out;
}

/* Moyenne DL/j sur les N derniers jours */
function avgOver(days) {
  const ds = dailySeries(H);
  if (!ds.length) return null;
  const slice = ds.slice(-days);
  if (!slice.length) return null;
  return slice.reduce((a, b) => a + b.dl, 0) / slice.length;
}

/* Groupement semaine ISO / mois */
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-S${String(Math.ceil(((t - y0) / 864e5 + 1) / 7)).padStart(2, "0")}`;
}
function groupBy(mode) {
  const ds = dailySeries(H);
  const m = new Map();
  ds.forEach(r => {
    const d = new Date(r.date);
    const k = mode === "week" ? isoWeek(d) : r.date.slice(0, 7);
    if (!m.has(k)) m.set(k, { key: k, dl: 0, fav: 0, days: 0 });
    const g = m.get(k); g.dl += r.dl; g.fav += r.fav; g.days++;
  });
  return [...m.values()].map(g => ({ ...g, avg: g.dl / g.days }));
}

/* ============================ KPI ============================ */
function renderKpi() {
  const last = H[H.length - 1];
  const D = buildDeltas(H);
  const l = D[D.length - 1];
  const totalDays = daysBetween(PROFILE.joined, last.date);

  const cards = [
    { label: "Uploads",            val: fmt(last.uploads),      sub: `${fmt1(last.uploads / (totalDays / 30))} / mois`, delta: l.dUp,  color: "v" },
    { label: "Téléchargements",    val: fmt(last.downloads),    sub: `${fmt1(last.downloads / totalDays)} / jour (all-time)`, delta: l.dDl, color: "b" },
    { label: "Favoris reçus",      val: fmt(last.favourites),   sub: `${((last.favourites / last.downloads) * 100).toFixed(2)} % des DL`, delta: l.dFav, color: "p" },
    { label: "Commentaires reçus", val: fmt(last.comments),     sub: `${fmt1(last.comments / last.uploads)} / loop`, delta: l.dCom, color: "o" },
    { label: "DL par loop",        val: fmt(Math.round(last.downloads / last.uploads)), sub: "moyenne", delta: null, color: "g" },
    { label: "Ancienneté",         val: `${(totalDays / 365).toFixed(1)} ans`, sub: `${fmt(totalDays)} jours`, delta: null, color: "n" },
  ];

  $("#kpiGrid").innerHTML = cards.map(c => `
    <div class="kpi kpi-${c.color}">
      <span class="kpi-label">${c.label}</span>
      <span class="kpi-val">${c.val}</span>
      <span class="kpi-sub">${c.sub}</span>
      ${c.delta !== null && c.delta !== undefined
        ? `<span class="kpi-delta ${c.delta > 0 ? "up" : c.delta < 0 ? "down" : ""}">${c.delta > 0 ? "▲ +" : c.delta < 0 ? "▼ " : "— "}${fmt(Math.abs(c.delta))}</span>`
        : ""}
    </div>`).join("");
}

/* ========================== VELOCITY ========================== */
function renderVelocity() {
  const rows = [
    { l: "Aujourd'hui / dernier relevé", d: 1 },
    { l: "Moyenne 7 jours",  d: 7 },
    { l: "Moyenne 14 jours", d: 14 },
    { l: "Moyenne 30 jours", d: 30 },
    { l: "Moyenne 90 jours", d: 90 },
    { l: "Moyenne 365 jours", d: 365 },
  ];
  const ref30 = avgOver(30);

  $("#velocityGrid").innerHTML = rows.map(r => {
    const v = avgOver(r.d);
    if (v === null) return `<div class="vel"><span class="vel-l">${r.l}</span><span class="vel-v muted">n/a</span></div>`;
    const trend = (ref30 && r.d <= 14) ? ((v - ref30) / ref30) * 100 : null;
    return `<div class="vel">
      <span class="vel-l">${r.l}</span>
      <span class="vel-v">${fmt1(v)} <em>DL/j</em></span>
      <span class="vel-x">≈ ${fmt(Math.round(v * 30))} / mois · ${fmt(Math.round(v * 365))} / an</span>
      ${trend !== null ? `<span class="vel-t ${trend >= 0 ? "up" : "down"}">${trend >= 0 ? "+" : ""}${trend.toFixed(1)} % vs 30j</span>` : ""}
    </div>`;
  }).join("");
}

/* =========================== CHARTS =========================== */
const C = { grid: "rgba(255,255,255,.07)", tick: "#8b93a7" };
const baseOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: "#c9d1e0", usePointStyle: true, boxWidth: 8 } } },
  scales: {
    x: { grid: { color: C.grid }, ticks: { color: C.tick, maxRotation: 0, autoSkipPadding: 20 } },
    y: { grid: { color: C.grid }, ticks: { color: C.tick } }
  }
};

function drawCumul(range) {
  let h = [...H];
  if (range !== "all") {
    const cut = new Date(H[H.length - 1].date); cut.setDate(cut.getDate() - (+range));
    h = H.filter(s => new Date(s.date) >= cut);
    if (h.length < 2) h = H.slice(-2);
  }
  charts.cumul?.destroy();
  charts.cumul = new Chart($("#chartCumul"), {
    type: "line",
    data: {
      labels: h.map(s => dFR(s.date)),
      datasets: [
        { label: "Téléchargements", data: h.map(s => s.downloads), borderColor: "#4f8cff", backgroundColor: "rgba(79,140,255,.15)", fill: true, tension: .3, yAxisID: "y", pointRadius: 2 },
        { label: "Favoris", data: h.map(s => s.favourites), borderColor: "#b57bff", tension: .3, yAxisID: "y1", pointRadius: 2 },
        { label: "Uploads", data: h.map(s => s.uploads), borderColor: "#26d07c", borderDash: [5, 4], tension: .3, yAxisID: "y1", pointRadius: 2 }
      ]
    },
    options: {
      ...baseOpts,
      scales: {
        x: baseOpts.scales.x,
        y:  { position: "left",  grid: { color: C.grid }, ticks: { color: C.tick } },
        y1: { position: "right", grid: { display: false }, ticks: { color: C.tick } }
      }
    }
  });
}

function drawDaily() {
  const ds = dailySeries(H).slice(-60);
  charts.daily?.destroy();
  charts.daily = new Chart($("#chartDaily"), {
    type: "bar",
    data: {
      labels: ds.map(r => dFR(r.date)),
      datasets: [{ label: "DL / jour", data: ds.map(r => +r.dl.toFixed(1)), backgroundColor: "#4f8cff", borderRadius: 3 }]
    },
    options: baseOpts
  });
}

function drawGroup(id, key, mode, color) {
  const g = groupBy(mode);
  charts[key]?.destroy();
  charts[key] = new Chart($(id), {
    type: "bar",
    data: {
      labels: g.map(r => r.key),
      datasets: [
        { label: "Total DL", data: g.map(r => Math.round(r.dl)), backgroundColor: color, borderRadius: 3 },
        { label: "Moy. / jour", data: g.map(r => +r.avg.toFixed(1)), type: "line", borderColor: "#ffb347", tension: .3, yAxisID: "y1", pointRadius: 3 }
      ]
    },
    options: {
      ...baseOpts,
      scales: {
        x: baseOpts.scales.x,
        y:  { grid: { color: C.grid }, ticks: { color: C.tick } },
        y1: { position: "right", grid: { display: false }, ticks: { color: C.tick } }
      }
    }
  });
}

/* =========================== TABLE =========================== */
function renderTable() {
  const mode = $("#tableGroup").value;
  const tb = $("#statsTable tbody");

  if (mode === "day") {
    const D = buildDeltas(H).slice().reverse();
    tb.innerHTML = D.map(r => `
      <tr>
        <td class="mono">${dFR(r.date)}</td>
        <td>${fmt(r.uploads)}</td>
        <td class="strong">${fmt(r.downloads)}</td>
        <td class="${r.dDl > 0 ? "pos" : ""}">${r.dDl ? "+" + fmt(r.dDl) : "—"}</td>
        <td>${r.dlDay ? fmt1(r.dlDay) : "—"}</td>
        <td>${fmt(r.favourites)}</td>
        <td class="${r.dFav > 0 ? "pos" : ""}">${r.dFav ? "+" + fmt(r.dFav) : "—"}</td>
        <td>${fmt(r.comments)}</td>
        <td class="${r.dCom > 0 ? "pos" : ""}">${r.dCom ? "+" + fmt(r.dCom) : "—"}</td>
        <td>${fmt(Math.round(r.downloads / r.uploads))}</td>
      </tr>`).join("") || `<tr><td colspan="10" class="muted">Aucune donnée</td></tr>`;
  } else {
    const g = groupBy(mode).reverse();
    tb.innerHTML = g.map(r => `
      <tr>
        <td class="mono">${r.key}</td>
        <td class="muted">—</td>
        <td class="muted">—</td>
        <td class="pos strong">+${fmt(Math.round(r.dl))}</td>
        <td>${fmt1(r.avg)}</td>
        <td class="muted">—</td>
        <td class="pos">+${fmt(Math.round(r.fav))}</td>
        <td class="muted">—</td>
        <td class="muted">—</td>
        <td class="muted">${r.days} j</td>
      </tr>`).join("") || `<tr><td colspan="10" class="muted">Pas assez de données</td></tr>`;
  }
}

function exportCsv() {
  const D = buildDeltas(H);
  const head = "date,uploads,downloads,delta_downloads,dl_per_day,favourites,delta_favourites,comments,delta_comments";
  const body = D.map(r => [r.date, r.uploads, r.downloads, r.dDl, r.dlDay.toFixed(2), r.favourites, r.dFav, r.comments, r.dCom].join(","));
  const blob = new Blob([[head, ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `looperman-stats-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

/* ============================ INIT ============================ */
(async function init() {
  const raw = await loadHistory();
  H = raw.slice().sort((a, b) => a.date.localeCompare(b.date));

  renderKpi();
  renderVelocity();
  drawCumul("30");
  drawDaily();
  drawGroup("#chartWeekly", "weekly", "week", "#26d07c");
  drawGroup("#chartMonthly", "monthly", "month", "#b57bff");
  renderTable();

  $("#lastUpdate").textContent = dFR(H[H.length - 1].date);
  $("#snapCount").textContent = H.length;

  $("#rangeBtns").addEventListener("click", e => {
    if (e.target.tagName !== "BUTTON") return;
    [...e.currentTarget.children].forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    drawCumul(e.target.dataset.range);
  });
  $("#tableGroup").addEventListener("change", renderTable);
  $("#exportCsv").addEventListener("click", exportCsv);

  // Partage vers goals.html
  localStorage.setItem("lm_last", JSON.stringify(H[H.length - 1]));
  localStorage.setItem("lm_avg30", avgOver(30) ?? 0);
  localStorage.setItem("lm_avg7", avgOver(7) ?? 0);
})();