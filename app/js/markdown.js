/*
 * Mini renderer markdown -> HTML, scritto apposta per non dipendere da
 * librerie esterne (l'app deve funzionare offline al 100%, anche senza
 * aver mai toccato una CDN). Copre il sottoinsieme di markdown usato nei
 * file di questo roadbook: titoli, paragrafi, liste, liste con checkbox,
 * tabelle GFM, grassetto/corsivo/codice inline, link (anche URL "nude"),
 * linee orizzontali e le righe "____"/"...." usate come spazi da compilare
 * a mano.
 */
(function (global) {
  "use strict";

  const MARK = String.fromCharCode(0); // carattere di controllo, non appare mai nel markdown reale

  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = (h * 33) ^ str.charCodeAt(i);
    }
    return (h >>> 0).toString(36);
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function inline(text) {
    let t = escapeHtml(text);
    const stash = [];
    function stow(html) {
      stash.push(html);
      return MARK + (stash.length - 1) + MARK;
    }
    // link [testo](url)
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, label, url) {
      return stow('<a href="' + url + '" target="_blank" rel="noopener">' + label + "</a>");
    });
    // URL "nude" (non già dentro un link markdown, già sostituito sopra)
    t = t.replace(/https?:\/\/[^\s<)]+/g, function (url) {
      return stow('<a href="' + url + '" target="_blank" rel="noopener">' + url + "</a>");
    });
    // codice `code`
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    // grassetto **bold**
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // corsivo *it* (non tocca ** già consumati)
    t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    // ripristina i link accantonati
    t = t.replace(new RegExp(MARK + "(\\d+)" + MARK, "g"), function (_, idx) {
      return stash[Number(idx)];
    });
    return t;
  }

  function isTableSeparator(line) {
    return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line.trim());
  }

  function splitRow(line) {
    let l = line.trim();
    if (l.startsWith("|")) l = l.slice(1);
    if (l.endsWith("|")) l = l.slice(0, -1);
    return l.split("|").map((c) => c.trim());
  }

  function mdToHtml(md, scopeId) {
    const lines = (md || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;
    let listType = null; // 'ul' | 'ol' | null
    let pendingLabel = ""; // ultimo paragrafo semplice, per etichettare i "fill blank"
    const emittedNotes = new Set();

    function closeList() {
      if (listType) {
        out.push(`</${listType}>`);
        listType = null;
      }
    }

    while (i < lines.length) {
      const raw = lines[i];
      const line = raw.trim();

      if (line === "") {
        i++;
        continue;
      }

      // riga di sole underscore -> campo compilabile
      if (/^_{3,}$/.test(line)) {
        closeList();
        const key = `blank:${scopeId}:${hash(pendingLabel || String(i))}`;
        out.push(
          `<p><input type="text" class="fill-blank" data-key="${key}" placeholder="${escapeHtml(pendingLabel || "")}"></p>`
        );
        i++;
        continue;
      }

      // riga di soli puntini (".....") -> area appunti libera.
      // Più righe di puntini sotto lo stesso titolo vengono unite in
      // un'unica textarea (per non ripeterla inutilmente).
      if (/^\.{6,}$/.test(line)) {
        closeList();
        const noteKey = `note:${scopeId}:${hash(pendingLabel || "appunti")}`;
        if (!emittedNotes.has(noteKey)) {
          emittedNotes.add(noteKey);
          out.push(
            `<textarea class="fill-blank" data-key="${noteKey}" rows="4" placeholder="Scrivi qui..."></textarea>`
          );
        }
        i++;
        continue;
      }

      // linea orizzontale --- (ma non un separatore di tabella già gestito altrove)
      if (/^-{3,}$/.test(line)) {
        closeList();
        out.push("<hr>");
        i++;
        continue;
      }

      // titoli
      const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (hMatch) {
        closeList();
        const level = hMatch[1].length;
        const content = inline(hMatch[2].trim());
        out.push(`<h${level}>${content}</h${level}>`);
        pendingLabel = hMatch[2].trim();
        i++;
        continue;
      }

      // tabella: riga con | e la successiva è un separatore
      if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        closeList();
        const header = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim().includes("|") && lines[i].trim() !== "") {
          rows.push(splitRow(lines[i]));
          i++;
        }
        let t = "<table><thead><tr>";
        header.forEach((h) => (t += `<th>${inline(h)}</th>`));
        t += "</tr></thead><tbody>";
        rows.forEach((r) => {
          t += "<tr>";
          header.forEach((_, idx) => (t += `<td>${inline(r[idx] || "")}</td>`));
          t += "</tr>";
        });
        t += "</tbody></table>";
        out.push(t);
        continue;
      }

      // checkbox list item - [ ] / - [x]
      const taskMatch = line.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/);
      if (taskMatch) {
        if (listType !== "ul") {
          closeList();
          out.push("<ul>");
          listType = "ul";
        }
        const checked = taskMatch[1].toLowerCase() === "x";
        const label = taskMatch[2].trim();
        const key = `chk:${scopeId}:${hash(label)}`;
        out.push(
          `<li class="task${checked ? " checked" : ""}"><input type="checkbox" data-key="${key}" ${checked ? "checked" : ""}><span>${inline(label)}</span></li>`
        );
        i++;
        continue;
      }

      // lista non ordinata
      const ulMatch = line.match(/^[-*]\s+(.*)$/);
      if (ulMatch) {
        if (listType !== "ul") {
          closeList();
          out.push("<ul>");
          listType = "ul";
        }
        out.push(`<li>${inline(ulMatch[1].trim())}</li>`);
        i++;
        continue;
      }

      // lista ordinata
      const olMatch = line.match(/^\d+\.\s+(.*)$/);
      if (olMatch) {
        if (listType !== "ol") {
          closeList();
          out.push("<ol>");
          listType = "ol";
        }
        out.push(`<li>${inline(olMatch[1].trim())}</li>`);
        i++;
        continue;
      }

      // paragrafo semplice (accorpa righe consecutive non vuote)
      closeList();
      const buf = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !/^_{3,}$/.test(lines[i].trim()) &&
        !/^-{3,}$/.test(lines[i].trim()) &&
        !/^#{1,6}\s/.test(lines[i].trim()) &&
        !/^[-*]\s/.test(lines[i].trim()) &&
        !/^\d+\.\s/.test(lines[i].trim()) &&
        !lines[i].includes("|")
      ) {
        buf.push(lines[i].trim());
        i++;
      }
      pendingLabel = buf.join(" ");
      out.push(`<p>${buf.map(inline).join("<br>")}</p>`);
    }
    closeList();
    return out.join("\n");
  }

  function wireInteractivity(container, storage) {
    storage = storage || global.localStorage;
    container.querySelectorAll("input[type=checkbox][data-key]").forEach((cb) => {
      const key = cb.getAttribute("data-key");
      const saved = storage.getItem(key);
      if (saved !== null) cb.checked = saved === "1";
      const li = cb.closest("li");
      if (li) li.classList.toggle("checked", cb.checked);
      cb.addEventListener("change", () => {
        storage.setItem(key, cb.checked ? "1" : "0");
        if (li) li.classList.toggle("checked", cb.checked);
      });
    });
    container.querySelectorAll("input.fill-blank[data-key], textarea.fill-blank[data-key]").forEach((inp) => {
      const key = inp.getAttribute("data-key");
      const saved = storage.getItem(key);
      if (saved !== null) inp.value = saved;
      inp.addEventListener("input", () => storage.setItem(key, inp.value));
    });
  }

  global.RoadbookMD = { mdToHtml, wireInteractivity, hash };
})(window);
