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
      // ordine lon|lat|type, come da specifiche ufficiali Sygic (iOS e Android):
      // com.sygic.aura://coordinate|lon|lat|drive
      sygicApp: `com.sygic.aura://coordinate|${lon}|${lat}|drive`,
      sygicWeb: `https://go.sygic.com/directions?to=${ll}`,
      google: `https://www.google.com/maps/dir/?api=1&destination=${ll}`,
      apple: `https://maps.apple.com/?daddr=${ll}&dirflg=d`,
      waze: `https://waze.com/ul?ll=${ll}&navigate=yes`,
    };
  }

  // Variante per le tappe con solo indirizzo testuale (niente coordinate
  // verificate): com.sygic.aura://search|indirizzo|drive, come da
  // specifiche ufficiali. L'indirizzo va percent-encoded.
  function urlsForAddress(address, googleUrl) {
    return {
      sygicApp: `com.sygic.aura://search|${encodeURIComponent(address)}|drive`,
      google: googleUrl,
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

  // Imposta il profilo veicolo in Sygic (rou=cmp per camper, rou=tru per
  // truck...). Comando "fire and forget": se Sygic non è installato non
  // succede visibilmente nulla, non c'è un fallback sensato da offrire.
  function setVehicleProfile(profile) {
    try {
      window.location.href = `com.sygic.aura://truckSettings|rou=${profile}`;
    } catch (e) {
      // schema non gestito: niente da fare, l'utente può impostarlo a mano
    }
  }

  function go(btn) {
    const target = btn.getAttribute("data-nav-target");
    const mode = btn.getAttribute("data-nav-mode") || "coord";

    if (target === "camperProfile") {
      setVehicleProfile("cmp");
      return;
    }

    if (mode === "address") {
      const address = btn.getAttribute("data-nav-address") || "";
      const googleUrl = btn.getAttribute("data-nav-google") || "";
      const u = urlsForAddress(address, googleUrl);
      if (target === "sygic") {
        openWithFallback(u.sygicApp, u.google);
      } else if (target === "google") {
        window.open(u.google, "_blank", "noopener");
      }
      return;
    }

    const lat = btn.getAttribute("data-nav-lat");
    const lon = btn.getAttribute("data-nav-lon");
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

  function buildCoordButtonsHtml(lat, lon) {
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

  function buildAddressButtonsHtml(address, googleUrl) {
    const escAddr = address.replace(/"/g, "&quot;");
    const escUrl = googleUrl.replace(/"/g, "&quot;");
    const btn = (target, icon, label, primary) =>
      `<button type="button" class="launch-btn${primary ? " primary" : ""}" data-nav-mode="address" data-nav-target="${target}" data-nav-address="${escAddr}" data-nav-google="${escUrl}">${icon} ${label}</button>`;
    return '<div class="launch-row">' + btn("sygic", "🧭", "Sygic", true) + btn("google", "📍", "Google Maps") + "</div>";
  }

  // Cerca nel container i link Google Maps (con coordinate o con
  // indirizzo testuale) e aggiunge subito dopo il paragrafo che li
  // contiene una riga di bottoni di navigazione rapida.
  function enhance(container) {
    if (!container) return;
    // selettore volutamente semplice (niente "&" o "?"): alcuni motori CSS
    // vanno in errore o non trovano nulla con caratteri speciali nel valore
    const anchors = Array.from(container.querySelectorAll('a[href*="google.com/maps/dir/"]'));
    anchors.forEach((a) => {
      const href = a.getAttribute("href");
      const p = a.closest("p") || a;
      if (p.nextElementSibling && p.nextElementSibling.classList && p.nextElementSibling.classList.contains("launch-row")) {
        return; // già aggiunto (es. in caso di doppio render)
      }

      const coordMatch = href.match(/destination=(-?\d+\.\d+),(-?\d+\.\d+)/);
      const wrap = document.createElement("div");
      if (coordMatch) {
        wrap.innerHTML = buildCoordButtonsHtml(coordMatch[1], coordMatch[2]);
      } else {
        const addrMatch = href.match(/destination=([^&]+)/);
        if (!addrMatch) return;
        const address = decodeURIComponent(addrMatch[1].replace(/\+/g, " "));
        wrap.innerHTML = buildAddressButtonsHtml(address, href);
      }
      p.insertAdjacentElement("afterend", wrap.firstElementChild);
    });
  }

  // Delegazione: un solo listener sul body per tutti i bottoni, anche
  // quelli aggiunti dopo (nuove pagine renderizzate).
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".launch-btn");
    if (!btn) return;
    e.preventDefault();
    go(btn);
  });

  global.RoadbookNav = { enhance, go, urlsFor, isIOS, isAndroid, setVehicleProfile };
})(window);
