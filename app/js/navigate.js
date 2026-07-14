/*
 * Bottoni "naviga verso" con tentativo Sygic + fallback automatico.
 * Non tocca i link testuali già presenti nel markdown (restano come
 * riferimento/copia manuale): aggiunge in più una riga di bottoni
 * pensata per il tocco su telefono, con rilevamento della piattaforma.
 */
(function (global) {
  "use strict";

  function isIOS() {
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPadOS 13+ si presenta come Mac ma ha il touch
    return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  }

  function isAndroid() {
    return /Android/.test(navigator.userAgent || "");
  }

  function urlsFor(lat, lon) {
    const ll = `${lat},${lon}`;
    return {
      sygicApp: `com.sygic.aura://coordinate|${lon}|${lat}|drive`,
      sygicWeb: `https://go.sygic.com/directions?to=${ll}`,
      google: `https://www.google.com/maps/dir/?api=1&destination=${ll}`,
      apple: `https://maps.apple.com/?daddr=${ll}&dirflg=d`,
      waze: `https://waze.com/ul?ll=${ll}&navigate=yes`,
    };
  }

  // Tenta di aprire l'app Sygic; se dopo un breve timeout la pagina
  // non è stata nascosta (segno che un'altra app si è aperta sopra),
  // apre l'alternativa passata come fallback.
  function openWithFallback(appUrl, fallbackUrl, timeoutMs) {
    timeoutMs = timeoutMs || 1300;
    let handed = false;
    function markHanded() {
      handed = true;
    }
    document.addEventListener("visibilitychange", markHanded, { once: true });
    window.addEventListener("blur", markHanded, { once: true });

    try {
      window.location.href = appUrl;
    } catch (e) {
      // alcuni browser rifiutano schemi custom non registrati: si passa
      // subito al fallback invece di aspettare il timeout
    }

    setTimeout(() => {
      document.removeEventListener("visibilitychange", markHanded);
      window.removeEventListener("blur", markHanded);
      if (!handed && fallbackUrl) {
        window.open(fallbackUrl, "_blank", "noopener");
      }
    }, timeoutMs);
  }

  function go(target, lat, lon) {
    const u = urlsFor(lat, lon);
    if (target === "sygic") {
      openWithFallback(u.sygicApp, u.google);
    } else if (target === "google") {
      window.open(u.google, "_blank", "noopener");
    } else if (target === "apple") {
      window.open(u.apple, "_blank", "noopener");
    } else if (target === "waze") {
      window.open(u.waze, "_blank", "noopener");
    }
  }

  function buildButtonsHtml(lat, lon) {
    const third = isIOS() ? { t: "apple", icon: "🍎", label: "Apple Maps" } : { t: "waze", icon: "🅆", label: "Waze" };
    const btn = (target, icon, label, primary) =>
      `<button type="button" class="launch-btn${primary ? " primary" : ""}" data-nav-target="${target}" data-nav-lat="${lat}" data-nav-lon="${lon}">${icon} ${label}</button>`;
    return (
      '<div class="launch-row">' +
      btn("sygic", "🧭", "Sygic", true) +
      btn("google", "📍", "Google Maps") +
      btn(third.t, third.icon, third.label) +
      "</div>"
    );
  }

  // Cerca nel container i link Google Maps con coordinate esplicite
  // (?...destination=lat,lon) e aggiunge subito dopo il paragrafo che
  // li contiene una riga di bottoni di navigazione rapida.
  function enhance(container) {
    if (!container) return;
    // selettore volutamente semplice (niente "&" o "?"): alcuni motori CSS
    // vanno in errore o non trovano nulla con caratteri speciali nel valore
    const anchors = Array.from(container.querySelectorAll('a[href*="google.com/maps/dir/"]'));
    anchors.forEach((a) => {
      const m = a.getAttribute("href").match(/destination=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (!m) return; // link ad indirizzo testuale, non a coordinate: niente bottoni
      const lat = m[1];
      const lon = m[2];
      const p = a.closest("p") || a;
      if (p.nextElementSibling && p.nextElementSibling.classList && p.nextElementSibling.classList.contains("launch-row")) {
        return; // già aggiunto (es. in caso di doppio render)
      }
      const wrap = document.createElement("div");
      wrap.innerHTML = buildButtonsHtml(lat, lon);
      p.insertAdjacentElement("afterend", wrap.firstElementChild);
    });
  }

  // Delegazione: un solo listener sul body per tutti i bottoni, anche
  // quelli aggiunti dopo (nuove pagine renderizzate).
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".launch-btn");
    if (!btn) return;
    e.preventDefault();
    go(btn.getAttribute("data-nav-target"), btn.getAttribute("data-nav-lat"), btn.getAttribute("data-nav-lon"));
  });

  global.RoadbookNav = { enhance, go, urlsFor, isIOS, isAndroid };
})(window);
