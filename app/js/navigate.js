/*
 * Bottoni "naviga verso" con tentativo Sygic + fallback automatico
 * (solo Android: su iOS il sistema mostra sempre una conferma nativa
 * per gli schemi custom, che renderebbe il fallback automatico
 * inaffidabile — vedi commento su openWithFallback). Tutte le
 * navigazioni avvengono nella stessa scheda (niente nuove schede
 * Chrome/Safari che si aprono da sole). Non tocca i link testuali
 * già presenti nel markdown (restano come riferimento/copia manuale):
 * aggiunge in più una riga di bottoni pensata per il tocco su
 * telefono, con rilevamento della piattaforma.
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

  // Safari (anche installata come PWA) su iOS è capriccioso quando si
  // prova ad aprire uno schema custom assegnando window.location.href
  // da uno script: a volte non succede proprio nulla, senza errori e
  // senza alcuna conferma. Il modo che funziona in modo affidabile è
  // creare un vero elemento <a href="schema://..."> e simulare il click
  // su quello, come farebbe la persona toccando un link vero.
  function openCustomScheme(url) {
    const a = document.createElement("a");
    a.href = url;
    a.style.position = "fixed";
    a.style.opacity = "0";
    a.style.pointerEvents = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 500);
  }

  // Tenta di aprire l'app Sygic; se dopo un breve timeout la pagina
  // non è stata nascosta (segno che un'altra app si è aperta sopra),
  // apre l'alternativa passata come fallback.
  //
  // Su iOS il sistema mostra sempre una conferma nativa ("Apri in
  // Sygic?") per gli schemi custom aperti da una pagina web, e quella
  // conferma può restare a schermo per un tempo imprevedibile mentre la
  // persona decide. In quel lasso di tempo la pagina NON risulta
  // nascosta, quindi un timer non può sapere se poi si è confermato
  // Sygic o no: rischia di aprire comunque Google Maps subito dopo,
  // anche a conferma già data. Per questo su iOS non si programma
  // nessun fallback automatico: si tenta solo Sygic, e se non si apre
  // la persona tocca semplicemente il bottone accanto (Google Maps /
  // Apple Maps). Su Android, dove questa conferma di sistema non c'è,
  // il fallback automatico resta attivo.
  function openWithFallback(appUrl, fallbackUrl, timeoutMs) {
    timeoutMs = timeoutMs || 1300;

    let threwSync = false;
    try {
      openCustomScheme(appUrl);
    } catch (e) {
      // qualche browser/webview rifiuta subito gli schemi custom non
      // registrati invece di limitarsi a ignorarli: lo segnaliamo, ma la
      // decisione su cosa fare dopo resta comunque legata alla piattaforma
      // (vedi sotto), non a questo dettaglio implementativo.
      threwSync = true;
    }

    if (!fallbackUrl) return;

    if (isIOS()) {
      // niente fallback automatico su iOS, vedi commento sopra: anche se
      // il tentativo ha lanciato un'eccezione, non c'è un timing
      // affidabile da usare, meglio lasciare il bottone accanto.
      return;
    }

    if (threwSync) {
      // niente da aspettare: si passa subito all'alternativa
      window.location.href = fallbackUrl;
      return;
    }

    let handed = false;
    function markHanded() {
      handed = true;
    }
    document.addEventListener("visibilitychange", markHanded, { once: true });
    window.addEventListener("blur", markHanded, { once: true });

    setTimeout(() => {
      document.removeEventListener("visibilitychange", markHanded);
      window.removeEventListener("blur", markHanded);
      if (!handed) {
        // stessa scheda, non una nuova: evita di lasciare schede vuote in giro
        window.location.href = fallbackUrl;
      }
    }, timeoutMs);
  }

  // Imposta il profilo veicolo in Sygic (rou=cmp per camper, rou=tru per
  // truck...). Comando "fire and forget": se Sygic non è installato non
  // succede visibilmente nulla, non c'è un fallback sensato da offrire.
  function setVehicleProfile(profile) {
    try {
      openCustomScheme(`com.sygic.aura://truckSettings|rou=${profile}`);
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
        window.location.href = u.google;
      }
      return;
    }

    const lat = btn.getAttribute("data-nav-lat");
    const lon = btn.getAttribute("data-nav-lon");
    const u = urlsFor(lat, lon);
    if (target === "sygic") {
      openWithFallback(u.sygicApp, u.google);
    } else if (target === "google") {
      window.location.href = u.google;
    } else if (target === "apple") {
      window.location.href = u.apple;
    } else if (target === "waze") {
      window.location.href = u.waze;
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
