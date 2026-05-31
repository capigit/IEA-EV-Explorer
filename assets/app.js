const CSV_PATH = "data/IEAGlobalEVData2024.csv";
const AGGREGATES = new Set(["World", "Europe", "EU27", "Rest of the world"]);
const POWERTRAINS = ["BEV", "PHEV", "FCEV"];
const NAME_FIX = { Korea: "South Korea", Turkiye: "Turkey", USA: "United States" };
const COLORS = ["#2563eb", "#14866d", "#c47a13", "#7353ba", "#0f8a9d", "#bf3b45"];

const state = {
  data: [],
  view: new URLSearchParams(window.location.search).get("view") || "overview",
  country: "France",
  countryB: "Germany",
  projectionRegion: "World",
  metric: "EV stock",
  mode: "Cars",
  year: 2023,
  heatNorm: "raw",
};

const views = {
  overview: { title: "Vue d'ensemble mondiale", render: renderOverview },
  insights: { title: "Insights clés", render: renderInsights },
  profile: { title: "Profil pays", render: renderProfile },
  compare: { title: "Comparaison A vs B", render: renderCompare },
  trends: { title: "Tendances temporelles", render: renderTrends },
  ranking: { title: "Classements pays", render: renderRanking },
  heatmap: { title: "Carte thermique", render: renderHeatmap },
  charging: { title: "Infrastructure de recharge", render: renderCharging },
  projections: { title: "Projections 2025-2035", render: renderProjections },
};

const content = document.getElementById("content");
const controls = document.getElementById("controls");
const statusEl = document.getElementById("status");
const titleEl = document.getElementById("view-title");

Papa.parse(CSV_PATH, {
  download: true,
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  complete: ({ data }) => {
    state.data = data
      .filter((row) => row.region && row.parameter && Number.isFinite(row.value))
      .map((row) => ({ ...row, year: Number(row.year), value: Number(row.value) }));
    statusEl.textContent = `${state.data.length.toLocaleString("fr-FR")} lignes chargees`;
    render();
  },
  error: () => {
    statusEl.textContent = "Erreur de chargement";
    content.innerHTML = `<div class="notice">Impossible de charger le CSV. Lancez un serveur local pour tester l'application.</div>`;
  },
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.view = button.dataset.view;
    render();
  });
});

window.addEventListener("resize", () => {
  Plotly.Plots.resize(content);
  if (window.innerWidth > 1040) closeSidebar();
});

function render() {
  if (!state.data.length) return;
  if (!views[state.view]) state.view = "overview";
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === state.view);
  });
  titleEl.textContent = views[state.view].title;
  controls.innerHTML = "";
  content.innerHTML = "";
  views[state.view].render();
}

function rows(filters = {}) {
  return state.data.filter((row) => Object.entries(filters).every(([key, value]) => {
    if (Array.isArray(value)) return value.includes(row[key]);
    if (value instanceof Set) return value.has(row[key]);
    return row[key] === value;
  }));
}

function sum(filters) {
  return rows(filters).reduce((total, row) => total + row.value, 0);
}

function first(filters) {
  const row = rows(filters)[0];
  return row ? row.value : 0;
}

function countries() {
  return [...new Set(state.data.map((row) => row.region))]
    .filter((region) => !AGGREGATES.has(region))
    .sort((a, b) => a.localeCompare(b));
}

function years(category = "Historical") {
  return [...new Set(rows({ category }).map((row) => row.year))].sort((a, b) => a - b);
}

function projectionRegions() {
  return [...new Set(state.data
    .filter((row) => row.category.startsWith("Projection-") && row.parameter === "EV stock" && row.mode === "Cars")
    .map((row) => row.region))]
    .sort((a, b) => {
      if (a === "World") return -1;
      if (b === "World") return 1;
      return a.localeCompare(b);
    });
}

function fmt(value, unit = "") {
  if (!Number.isFinite(value)) return "n/a";
  if (unit === "%") return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k`;
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

function metric(label, value, delta = null) {
  const deltaHtml = delta === null ? "" : `<p class="delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "+" : ""}${delta.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</p>`;
  return `<article class="metric"><p class="label">${label}</p><p class="value">${value}</p>${deltaHtml}</article>`;
}

function panel(title, subtitle, id, tall = false) {
  return `<article class="panel"><div class="panel-head"><h3>${title}</h3>${subtitle ? `<p>${subtitle}</p>` : ""}</div><div id="${id}" class="chart ${tall ? "tall" : ""}"></div></article>`;
}

function selectControl(key, label, options) {
  const value = state[key];
  const html = `<div class="field"><label for="${key}">${label}</label><select id="${key}">${options.map((option) => (
    `<option value="${option}" ${String(option) === String(value) ? "selected" : ""}>${option}</option>`
  )).join("")}</select></div>`;
  controls.insertAdjacentHTML("beforeend", html);
  document.getElementById(key).addEventListener("change", (event) => {
    state[key] = Number.isFinite(Number(event.target.value)) && key === "year"
      ? Number(event.target.value)
      : event.target.value;
    render();
  });
}

function plot(id, traces, layout = {}) {
  const base = {
    paper_bgcolor: "rgba(255,255,255,0)",
    plot_bgcolor: "rgba(255,255,255,0)",
    font: { family: "Inter, system-ui, sans-serif", color: "#1f2933" },
    margin: { l: 58, r: 22, t: 28, b: 48 },
    colorway: COLORS,
    hovermode: "closest",
    legend: { orientation: "h", y: -0.18 },
  };
  Plotly.newPlot(id, traces, { ...base, ...layout }, { responsive: true, displayModeBar: false });
}

function groupedByRegion(filters, includeAggregates = false) {
  const map = new Map();
  rows(filters).forEach((row) => {
    if (!includeAggregates && AGGREGATES.has(row.region)) return;
    map.set(row.region, (map.get(row.region) || 0) + row.value);
  });
  return [...map.entries()].map(([region, value]) => ({ region, value }));
}

function series(region, parameter, mode, category = "Historical") {
  const map = new Map();
  rows({ region, parameter, mode, category }).forEach((row) => {
    if (parameter.includes("share") && row.powertrain !== "EV") return;
    if (!parameter.includes("share") && !POWERTRAINS.includes(row.powertrain)) return;
    map.set(row.year, (map.get(row.year) || 0) + row.value);
  });
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([year, value]) => ({ year, value }));
}

function renderOverview() {
  const stock23 = sum({ region: "World", category: "Historical", parameter: "EV stock", mode: "Cars", powertrain: POWERTRAINS, year: 2023 });
  const stock22 = sum({ region: "World", category: "Historical", parameter: "EV stock", mode: "Cars", powertrain: POWERTRAINS, year: 2022 });
  const sales23 = sum({ region: "World", category: "Historical", parameter: "EV sales", mode: "Cars", powertrain: POWERTRAINS, year: 2023 });
  const sales22 = sum({ region: "World", category: "Historical", parameter: "EV sales", mode: "Cars", powertrain: POWERTRAINS, year: 2022 });
  const share23 = first({ region: "World", category: "Historical", parameter: "EV sales share", mode: "Cars", powertrain: "EV", year: 2023 });
  const charge23 = sum({ region: "World", category: "Historical", parameter: "EV charging points", mode: "EV", powertrain: ["Publicly available fast", "Publicly available slow"], year: 2023 });
  const charge22 = sum({ region: "World", category: "Historical", parameter: "EV charging points", mode: "EV", powertrain: ["Publicly available fast", "Publicly available slow"], year: 2022 });

  content.innerHTML = `
    <section class="grid cols-4">
      ${metric("Stock VE mondial", fmt(stock23), ((stock23 - stock22) / stock22) * 100)}
      ${metric("Ventes VE 2023", fmt(sales23), ((sales23 - sales22) / sales22) * 100)}
      ${metric("Part de marche VE", fmt(share23, "%"), null)}
      ${metric("Bornes publiques", fmt(charge23), ((charge23 - charge22) / charge22) * 100)}
    </section>
    ${panel("Carte mondiale", "Stock VE voitures en 2023", "map", true)}
    <section class="grid cols-2">
      ${panel("Top 15 pays", "Stock VE voitures en 2023", "topCountries")}
      ${panel("BEV vs PHEV", "Repartition du stock dans le top 10", "split")}
    </section>
  `;

  const mapData = groupedByRegion({ category: "Historical", parameter: "EV stock", mode: "Cars", powertrain: POWERTRAINS, year: 2023 })
    .map((row) => ({ ...row, country: NAME_FIX[row.region] || row.region }));
  plot("map", [{
    type: "choropleth",
    locationmode: "country names",
    locations: mapData.map((row) => row.country),
    z: mapData.map((row) => row.value / 1e6),
    text: mapData.map((row) => row.region),
    colorscale: "YlGnBu",
    colorbar: { title: "M veh." },
  }], { geo: { projection: { type: "natural earth" }, showframe: false }, margin: { l: 0, r: 0, t: 10, b: 0 } });

  const top = groupedByRegion({ category: "Historical", parameter: "EV stock", mode: "Cars", powertrain: POWERTRAINS, year: 2023 })
    .sort((a, b) => b.value - a.value)
    .slice(0, 15)
    .reverse();
  plot("topCountries", [{ type: "bar", orientation: "h", x: top.map((r) => r.value / 1e6), y: top.map((r) => r.region), marker: { color: "#2563eb" } }], { xaxis: { title: "Millions de vehicules" } });

  const top10 = top.slice().reverse().slice(0, 10).map((row) => row.region);
  const bev = top10.map((region) => sum({ region, category: "Historical", parameter: "EV stock", mode: "Cars", powertrain: "BEV", year: 2023 }) / 1e6);
  const phev = top10.map((region) => sum({ region, category: "Historical", parameter: "EV stock", mode: "Cars", powertrain: "PHEV", year: 2023 }) / 1e6);
  plot("split", [
    { type: "bar", x: top10, y: bev, name: "BEV", marker: { color: "#2563eb" } },
    { type: "bar", x: top10, y: phev, name: "PHEV", marker: { color: "#f3c969" } },
  ], { barmode: "stack", yaxis: { title: "Millions" } });
}

function renderInsights() {
  const share = rows({ category: "Historical", parameter: "EV sales share", mode: "Cars", powertrain: "EV", year: 2023 })
    .filter((row) => !AGGREGATES.has(row.region))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .reverse();
  const growth = countries().map((region) => {
    const a = sum({ region, category: "Historical", parameter: "EV sales", mode: "Cars", powertrain: POWERTRAINS, year: 2022 });
    const b = sum({ region, category: "Historical", parameter: "EV sales", mode: "Cars", powertrain: POWERTRAINS, year: 2023 });
    return { region, value: a > 0 ? ((b - a) / a) * 100 : 0 };
  }).filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 10).reverse();
  const ratio = countries().map((region) => {
    const charging = sum({ region, category: "Historical", parameter: "EV charging points", mode: "EV", powertrain: ["Publicly available fast", "Publicly available slow"], year: 2023 });
    const stock = sum({ region, category: "Historical", parameter: "EV stock", mode: "Cars", powertrain: POWERTRAINS, year: 2023 });
    return { region, value: stock > 0 ? (charging / stock) * 1000 : 0 };
  }).filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 10).reverse();

  content.innerHTML = `
    <section class="grid cols-3">
      ${metric("Champion penetration", `${share.at(-1).region} · ${fmt(share.at(-1).value, "%")}`)}
      ${metric("Croissance record", `${growth.at(-1).region} · +${fmt(growth.at(-1).value, "%")}`)}
      ${metric("Meilleur ratio recharge", `${ratio.at(-1).region} · ${fmt(ratio.at(-1).value)}/1000 VE`)}
    </section>
    <section class="grid cols-2">
      ${panel("Part de marche VE", "Top 10 voitures, 2023", "shareChart")}
      ${panel("Croissance ventes", "Variation 2022-2023", "growthChart")}
      ${panel("Bornes par 1 000 VE", "Infrastructure publique, 2023", "ratioChart")}
      ${panel("Stock mondial", "Historique voitures", "worldStock")}
    </section>
  `;
  plot("shareChart", [{ type: "bar", orientation: "h", x: share.map((r) => r.value), y: share.map((r) => r.region), marker: { color: "#14866d" } }], { xaxis: { title: "%" } });
  plot("growthChart", [{ type: "bar", orientation: "h", x: growth.map((r) => r.value), y: growth.map((r) => r.region), marker: { color: "#c47a13" } }], { xaxis: { title: "%" } });
  plot("ratioChart", [{ type: "bar", orientation: "h", x: ratio.map((r) => r.value), y: ratio.map((r) => r.region), marker: { color: "#0f8a9d" } }]);
  const world = series("World", "EV stock", "Cars");
  plot("worldStock", [{ type: "scatter", mode: "lines", fill: "tozeroy", x: world.map((r) => r.year), y: world.map((r) => r.value / 1e6), line: { color: "#2563eb", width: 3 } }], { yaxis: { title: "Millions" } });
}

function renderProfile() {
  selectControl("country", "Pays", countries());
  const stock = sum({ region: state.country, category: "Historical", parameter: "EV stock", mode: "Cars", powertrain: POWERTRAINS, year: 2023 });
  const sales = sum({ region: state.country, category: "Historical", parameter: "EV sales", mode: "Cars", powertrain: POWERTRAINS, year: 2023 });
  const share = first({ region: state.country, category: "Historical", parameter: "EV sales share", mode: "Cars", powertrain: "EV", year: 2023 });
  const charge = sum({ region: state.country, category: "Historical", parameter: "EV charging points", mode: "EV", powertrain: ["Publicly available fast", "Publicly available slow"], year: 2023 });
  content.innerHTML = `
    <section class="grid cols-4">${metric("Stock 2023", fmt(stock))}${metric("Ventes 2023", fmt(sales))}${metric("Part de marche", fmt(share, "%"))}${metric("Bornes publiques", fmt(charge))}</section>
    <section class="grid cols-2">
      ${panel("Stock et ventes", state.country, "profileTrend")}
      ${panel("Mix BEV/PHEV", "Stock voitures 2023", "profileMix")}
    </section>
  `;
  const stockSeries = series(state.country, "EV stock", "Cars");
  const salesSeries = series(state.country, "EV sales", "Cars");
  plot("profileTrend", [
    { type: "scatter", mode: "lines+markers", x: stockSeries.map((r) => r.year), y: stockSeries.map((r) => r.value), name: "Stock", line: { color: "#2563eb" } },
    { type: "scatter", mode: "lines+markers", x: salesSeries.map((r) => r.year), y: salesSeries.map((r) => r.value), name: "Ventes", line: { color: "#14866d" }, yaxis: "y2" },
  ], { yaxis: { title: "Stock" }, yaxis2: { title: "Ventes", overlaying: "y", side: "right" } });
  plot("profileMix", [{ type: "pie", labels: ["BEV", "PHEV", "FCEV"], values: POWERTRAINS.map((pt) => sum({ region: state.country, category: "Historical", parameter: "EV stock", mode: "Cars", powertrain: pt, year: 2023 })), hole: 0.42 }]);
}

function renderCompare() {
  selectControl("country", "Pays A", countries());
  selectControl("countryB", "Pays B", countries());
  const a = state.country;
  const b = state.countryB;
  content.innerHTML = `
    <section class="grid cols-2">
      ${panel("Stock VE", `${a} vs ${b}`, "compareStock")}
      ${panel("Part de marche", `${a} vs ${b}`, "compareShare")}
    </section>
    ${panel("Indicateurs 2023", "Stock, ventes, part et recharge", "compareBars")}
  `;
  [parameterPlot("compareStock", "EV stock", a, b), parameterPlot("compareShare", "EV sales share", a, b)];
  const labels = ["Stock", "Ventes", "Part (%)", "Bornes"];
  const valuesA = [
    sum({ region: a, category: "Historical", parameter: "EV stock", mode: "Cars", powertrain: POWERTRAINS, year: 2023 }) / 1e6,
    sum({ region: a, category: "Historical", parameter: "EV sales", mode: "Cars", powertrain: POWERTRAINS, year: 2023 }) / 1e6,
    first({ region: a, category: "Historical", parameter: "EV sales share", mode: "Cars", powertrain: "EV", year: 2023 }),
    sum({ region: a, category: "Historical", parameter: "EV charging points", mode: "EV", powertrain: ["Publicly available fast", "Publicly available slow"], year: 2023 }) / 100000,
  ];
  const valuesB = [
    sum({ region: b, category: "Historical", parameter: "EV stock", mode: "Cars", powertrain: POWERTRAINS, year: 2023 }) / 1e6,
    sum({ region: b, category: "Historical", parameter: "EV sales", mode: "Cars", powertrain: POWERTRAINS, year: 2023 }) / 1e6,
    first({ region: b, category: "Historical", parameter: "EV sales share", mode: "Cars", powertrain: "EV", year: 2023 }),
    sum({ region: b, category: "Historical", parameter: "EV charging points", mode: "EV", powertrain: ["Publicly available fast", "Publicly available slow"], year: 2023 }) / 100000,
  ];
  plot("compareBars", [
    { type: "bar", x: labels, y: valuesA, name: a, marker: { color: "#2563eb" } },
    { type: "bar", x: labels, y: valuesB, name: b, marker: { color: "#c47a13" } },
  ], { barmode: "group" });
}

function parameterPlot(id, parameter, a, b) {
  const sa = series(a, parameter, "Cars");
  const sb = series(b, parameter, "Cars");
  plot(id, [
    { type: "scatter", mode: "lines+markers", x: sa.map((r) => r.year), y: sa.map((r) => r.value), name: a },
    { type: "scatter", mode: "lines+markers", x: sb.map((r) => r.year), y: sb.map((r) => r.value), name: b },
  ]);
}

function renderTrends() {
  selectControl("metric", "Indicateur", ["EV stock", "EV sales", "EV sales share", "EV stock share", "Electricity demand", "Oil displacement Mbd"]);
  selectControl("mode", "Mode", ["Cars", "Buses", "Trucks", "Vans"]);
  const regions = ["World", "China", "USA", "Germany", "France", "Norway"];
  content.innerHTML = `${panel("Series historiques", `${state.metric} · ${state.mode}`, "trendMain", true)}`;
  plot("trendMain", regions.map((region) => {
    const s = series(region, state.metric, state.mode);
    return { type: "scatter", mode: "lines+markers", x: s.map((r) => r.year), y: s.map((r) => r.value), name: region };
  }));
}

function renderRanking() {
  selectControl("metric", "Indicateur", ["EV stock", "EV sales", "EV sales share", "EV stock share", "Electricity demand"]);
  selectControl("year", "Annee", years("Historical"));
  const powertrain = state.metric.includes("share") ? "EV" : POWERTRAINS;
  const data = groupedByRegion({ category: "Historical", parameter: state.metric, mode: "Cars", powertrain, year: state.year })
    .sort((a, b) => b.value - a.value)
    .slice(0, 20)
    .reverse();
  content.innerHTML = `${panel("Top 20 pays", `${state.metric} · voitures · ${state.year}`, "rankingChart", true)}`;
  plot("rankingChart", [{ type: "bar", orientation: "h", x: data.map((r) => r.value), y: data.map((r) => r.region), marker: { color: "#7353ba" } }]);
}

function renderHeatmap() {
  selectControl("metric", "Indicateur", ["EV stock", "EV sales", "EV sales share"]);
  selectControl("heatNorm", "Mode", ["raw", "base 100"]);
  const top = groupedByRegion({ category: "Historical", parameter: "EV stock", mode: "Cars", powertrain: POWERTRAINS, year: 2023 })
    .sort((a, b) => b.value - a.value)
    .slice(0, 18)
    .map((row) => row.region);
  const ys = years("Historical");
  const z = top.map((region) => {
    const vals = ys.map((year) => {
      const powertrain = state.metric.includes("share") ? "EV" : POWERTRAINS;
      return sum({ region, category: "Historical", parameter: state.metric, mode: "Cars", powertrain, year });
    });
    if (state.heatNorm === "base 100") {
      const base = vals.find((value) => value > 0) || 1;
      return vals.map((value) => (value / base) * 100);
    }
    return vals;
  });
  content.innerHTML = `${panel("Matrice pays x annees", `${state.metric} · voitures`, "heatmapChart", true)}`;
  plot("heatmapChart", [{ type: "heatmap", x: ys, y: top, z, colorscale: "Viridis" }], { margin: { l: 110, r: 20, t: 20, b: 50 } });
}

function renderCharging() {
  const data = countries().map((region) => ({
    region,
    fast: sum({ region, category: "Historical", parameter: "EV charging points", mode: "EV", powertrain: "Publicly available fast", year: 2023 }),
    slow: sum({ region, category: "Historical", parameter: "EV charging points", mode: "EV", powertrain: "Publicly available slow", year: 2023 }),
    stock: sum({ region, category: "Historical", parameter: "EV stock", mode: "Cars", powertrain: POWERTRAINS, year: 2023 }),
  })).map((row) => ({ ...row, total: row.fast + row.slow, ratio: row.stock ? ((row.fast + row.slow) / row.stock) * 1000 : 0 }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)
    .reverse();
  content.innerHTML = `
    <section class="grid cols-2">
      ${panel("Bornes publiques", "Top 15 pays, 2023", "chargingStack")}
      ${panel("Bornes par 1 000 VE", "Ratio infrastructure / parc", "chargingRatio")}
    </section>
  `;
  plot("chargingStack", [
    { type: "bar", orientation: "h", x: data.map((r) => r.fast), y: data.map((r) => r.region), name: "Rapides", marker: { color: "#bf3b45" } },
    { type: "bar", orientation: "h", x: data.map((r) => r.slow), y: data.map((r) => r.region), name: "Lentes", marker: { color: "#0f8a9d" } },
  ], { barmode: "stack" });
  plot("chargingRatio", [{ type: "bar", orientation: "h", x: data.map((r) => r.ratio), y: data.map((r) => r.region), marker: { color: "#14866d" } }]);
}

function renderProjections() {
  const availableRegions = projectionRegions();
  if (!availableRegions.includes(state.projectionRegion)) state.projectionRegion = availableRegions[0] || "World";
  selectControl("projectionRegion", "Region", availableRegions);
  const steps = projectionSeries(state.projectionRegion, "Projection-STEPS");
  const aps = projectionSeries(state.projectionRegion, "Projection-APS");
  content.innerHTML = `
    <section class="grid cols-3">
      ${metric("STEPS 2035", fmt(steps.find((r) => r.year === 2035)?.value || 0))}
      ${metric("APS 2035", fmt(aps.find((r) => r.year === 2035)?.value || 0))}
      ${metric("Ecart APS/STEPS", fmt((aps.find((r) => r.year === 2035)?.value || 0) - (steps.find((r) => r.year === 2035)?.value || 0)))}
    </section>
    ${panel("Scenarios de stock VE", `${state.projectionRegion} · voitures`, "projectionChart", true)}
  `;
  plot("projectionChart", [
    { type: "scatter", mode: "lines+markers", x: steps.map((r) => r.year), y: steps.map((r) => r.value), name: "STEPS", line: { color: "#c47a13", width: 3 } },
    { type: "scatter", mode: "lines+markers", x: aps.map((r) => r.year), y: aps.map((r) => r.value), name: "APS", line: { color: "#14866d", width: 3 } },
  ]);
}

function projectionSeries(region, category) {
  const map = new Map();
  rows({ region, category, parameter: "EV stock", mode: "Cars" }).forEach((row) => {
    if (!POWERTRAINS.includes(row.powertrain)) return;
    map.set(row.year, (map.get(row.year) || 0) + row.value);
  });
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([year, value]) => ({ year, value }));
}

// ── Mobile sidebar drawer ──

const menuToggle = document.getElementById("menuToggle");
const sidebarClose = document.getElementById("sidebarClose");
const sidebar = document.querySelector(".sidebar");
const overlay = document.getElementById("sidebarOverlay");

function openSidebar() {
  sidebar.classList.add("open");
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("open");
  document.body.style.overflow = "";
}

menuToggle.addEventListener("click", openSidebar);
sidebarClose.addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", closeSidebar);
});
