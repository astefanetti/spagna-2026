(function () {
  "use strict";

  const $view = document.getElementById("view");
  const $titleMain = document.getElementById("topbar-title-main");
  const $titleSub = document.getElementById("topbar-title-sub");
  const $back = document.getElementById("btn-back");
  const $refresh = document.getElementById("btn-refresh");
  const $progressBar = document.getElementById("progress-bar");
  const $toast = document.getElementById("toast");
  const navButtons = Array.from(document.querySelectorAll(".nav-btn"));

  let DAYS = [];
  let PAGES = [];
  let dataReady = false;

  function todayStr() {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function showToast(msg) {
    $toast.textContent = msg;
    $toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => ($toast.hidden = true), 2200);
  }

  async function loadData() {
    const [daysRes, pagesRes] = await Promise.all([
      fetch("data/days.json", { cache: "no-store" }).catch(() => null),
      fetch("data/pages.json", { cache: "no-store" }).catch(() => null),
    ]);
    DAYS = daysRes && daysRes.ok ? await daysRes.json() : [];
    PAGES = pagesRes && pagesRes.ok ? await pagesRes.json() : [];
    dataReady = true;
  }

  function dayStatus(day) {
    const t = todayStr();
    if (!day.date) return "unknown";
    if (day.date === t) return "today";
    return day.date < t ? "past" : "future";
  }

  function findTodayDay() {
    const t = todayStr();
    return DAYS.find((d) => d.date === t);
  }

  function updateProgress() {
    if (!DAYS.length) {
      $progressBar.style.width = "0%";
      return;
    }
    const t = todayStr();
    const total = DAYS.length;
    let done = DAYS.filter((d) => d.date && d.date < t).length;
    if (findTodayDay()) done += 0.5;
    const pct = Math.max(0, Math.min(100, (done / total) * 100));
    $progressBar.style.width = pct + "%";
  }

  function setHeader(main, sub, showBack) {
    $titleMain.textContent = main;
    $titleSub.textContent = sub || "";
    $back.hidden = !showBack;
  }

  function setActiveNav(route) {
    navButtons.forEach((b) => {
      const r = b.getAttribute("data-route");
      const active =
        (r === "#/" && (route === "#/" || route.startsWith("#/day"))) ||
        (r === "#/giorni" && route.startsWith("#/giorni")) ||
        (r === "#/info" && (route.startsWith("#/info") || route.startsWith("#/page")));
      b.classList.toggle("active", active);
    });
  }

  function badgeIcon(label, value, tone) {
    if (value === undefined || value === null || value === "") return "";
    return `<span class="badge${tone ? " " + tone : ""}">${label}: ${value}</span>`;
  }

  function toneFor(bool) {
    if (bool === true) return "warn";
    if (bool === false) return "ok";
    return "";
  }

  function dayDashboardBadges(day) {
    const items = [];
    items.push(badgeIcon("⛽ Carburante", day.fuel && day.fuel.departure, toneFor(day.fuel && day.fuel.refill)));
    items.push(badgeIcon("💧 Acqua", day.water && day.water.departure, toneFor(day.water && day.water.refill)));
    items.push(
      badgeIcon(
        "🚽 Camper service",
        day.camper_service && day.camper_service.required !== undefined
          ? day.camper_service.required === true
            ? "Sì"
            : day.camper_service.required === false
            ? "No"
            : String(day.camper_service.required)
          : "",
        day.camper_service && day.camper_service.required === true ? "warn" : ""
      )
    );
    items.push(
      badgeIcon(
        "🛒 Spesa",
        day.shopping && day.shopping.required !== undefined
          ? day.shopping.required === true
            ? "Sì"
            : day.shopping.required === false
            ? "No"
            : String(day.shopping.required)
          : "",
        day.shopping && day.shopping.required === true ? "warn" : ""
      )
    );
    items.push(badgeIcon("🚐 Km", day.distance_km));
    items.push(badgeIcon("⏱ Guida", day.drive_time));
    items.push(badgeIcon("💪 Difficoltà", day.difficulty));
    return items.filter(Boolean).join("");
  }

  // ---------- VIEWS ----------

  function renderHome() {
    setHeader("Roadbook Spagna", "17 lug – 3 ago 2026", false);
    const t = todayStr();
    const today = findTodayDay();
    let heroHtml;

    if (today) {
      heroHtml = `
        <div class="hero-card">
          <div class="eyebrow">Oggi · Giorno ${today.day}</div>
          <h1>${today.title || ""}</h1>
          <p>${today.subtitle || ""}</p>
          <a class="cta" href="#/day/${today.day}">Apri la giornata →</a>
        </div>`;
    } else if (DAYS.length && t < DAYS[0].date) {
      const days = Math.round((new Date(DAYS[0].date) - new Date(t)) / 86400000);
      heroHtml = `
        <div class="hero-card">
          <div class="eyebrow">Si parte</div>
          <h1>${days} giorni al via</h1>
          <p>Partenza: ${fmtDate(DAYS[0].date)} — ${DAYS[0].title || ""}</p>
          <a class="cta" href="#/day/1">Vedi il Giorno 1 →</a>
        </div>`;
    } else if (DAYS.length && t > DAYS[DAYS.length - 1].date) {
      heroHtml = `
        <div class="hero-card">
          <div class="eyebrow">Viaggio concluso</div>
          <h1>Bentornati! 🎉</h1>
          <p>18 giorni, un van, tante spiagge e Daisy sempre in prima fila.</p>
          <a class="cta" href="#/giorni">Rivedi il viaggio →</a>
        </div>`;
    } else {
      heroHtml = `
        <div class="hero-card">
          <div class="eyebrow">Roadbook Spagna 2026</div>
          <h1>Pronti a partire</h1>
          <p>17 luglio – 3 agosto, 18 giorni in van.</p>
          <a class="cta" href="#/giorni">Vedi tutte le giornate →</a>
        </div>`;
    }

    const nextDays = DAYS.filter((d) => dayStatus(d) !== "past").slice(0, 3);
    const nextHtml = nextDays
      .map((d) => dayRowHtml(d))
      .join("");

    $view.innerHTML = `
      ${heroHtml}
      <div class="section-title">Prossime giornate</div>
      ${nextHtml || '<div class="empty-state">Nessuna giornata futura da mostrare.</div>'}
      <div class="section-title">Scorciatoie</div>
      <a class="info-row" href="#/page/checklist-generale">✅ Checklist generale</a>
      <a class="info-row" href="#/page/numeri-utili">📞 Numeri utili</a>
    `;
    updateProgress();
  }

  function dayRowHtml(d) {
    const status = dayStatus(d);
    return `
      <a class="day-row ${status === "today" ? "is-today" : ""} ${status === "past" ? "is-past" : ""}" href="#/day/${d.day}">
        <div class="day-num">${d.day}</div>
        <div class="day-info">
          <div class="d-title">${d.title || "Giorno " + d.day}</div>
          <div class="d-meta">${d.weekday || ""} ${fmtDate(d.date)} · ${d.start || ""} → ${d.destination || ""}</div>
        </div>
        <div class="day-chevron">›</div>
      </a>`;
  }

  function renderGiorniList() {
    setHeader("Tutte le giornate", `${DAYS.length} giorni`, false);
    $view.innerHTML = DAYS.map(dayRowHtml).join("") || '<div class="empty-state">Nessun dato caricato.</div>';
    updateProgress();
  }

  function renderDay(num) {
    const day = DAYS.find((d) => d.day === num);
    if (!day) {
      $view.innerHTML = '<div class="empty-state">Giornata non trovata.</div>';
      return;
    }
    setHeader(`Giorno ${day.day}`, day.title || "", true);

    const prev = DAYS.find((d) => d.day === day.day - 1);
    const next = DAYS.find((d) => d.day === day.day + 1);

    const bodyHtml = window.RoadbookMD.mdToHtml(day.body || "", `day-${day.day}`);

    $view.innerHTML = `
      <div class="card">
        <div class="badge-row">${dayDashboardBadges(day)}</div>
        ${day.main_goal ? `<p style="margin-top:8px"><strong>Obiettivo:</strong> ${day.main_goal}</p>` : ""}
      </div>
      <div class="md">${bodyHtml}</div>
      <div class="day-pager">
        ${prev ? `<a href="#/day/${prev.day}">← Giorno ${prev.day}</a>` : "<span></span>"}
        ${next ? `<a href="#/day/${next.day}">Giorno ${next.day} →</a>` : "<span></span>"}
      </div>
    `;
    window.RoadbookMD.wireInteractivity($view);
    if (window.RoadbookNav) window.RoadbookNav.enhance($view);
    updateProgress();
  }

  function renderInfoList() {
    setHeader("Info & guide", "", false);
    const groups = {};
    PAGES.forEach((p) => {
      groups[p.group] = groups[p.group] || [];
      groups[p.group].push(p);
    });
    let html = "";
    Object.keys(groups).forEach((g) => {
      html += `<div class="info-group-title">${g}</div>`;
      groups[g]
        .sort((a, b) => a.order - b.order)
        .forEach((p) => {
          html += `<a class="info-row" href="#/page/${p.id}">${p.title}</a>`;
        });
    });
    $view.innerHTML = html || '<div class="empty-state">Nessuna pagina disponibile.</div>';
  }

  function renderPage(id) {
    const page = PAGES.find((p) => p.id === id);
    if (!page) {
      $view.innerHTML = '<div class="empty-state">Pagina non trovata.</div>';
      return;
    }
    setHeader(page.title, page.group, true);
    const bodyHtml = window.RoadbookMD.mdToHtml(page.body || "", `page-${page.id}`);
    $view.innerHTML = `<div class="md">${bodyHtml}</div>`;
    window.RoadbookMD.wireInteractivity($view);
    if (window.RoadbookNav) window.RoadbookNav.enhance($view);
  }

  // ---------- ROUTER ----------

  function route() {
    const hash = location.hash || "#/";
    setActiveNav(hash);

    if (!dataReady) {
      $view.innerHTML = '<div class="empty-state">Caricamento...</div>';
      return;
    }

    let m;
    if (hash === "#/" || hash === "") {
      renderHome();
    } else if (hash === "#/giorni") {
      renderGiorniList();
    } else if ((m = hash.match(/^#\/day\/(\d+)$/))) {
      renderDay(parseInt(m[1], 10));
    } else if (hash === "#/info") {
      renderInfoList();
    } else if ((m = hash.match(/^#\/page\/([\w-]+)$/))) {
      renderPage(m[1]);
    } else {
      renderHome();
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", route);
  $back.addEventListener("click", () => history.back());
  $refresh.addEventListener("click", async () => {
    await loadData();
    route();
    showToast("Dati aggiornati");
  });

  navButtons.forEach((b) =>
    b.addEventListener("click", () => {
      location.hash = b.getAttribute("data-route");
    })
  );

  // ---------- INIT ----------

  loadData().then(() => {
    route();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
