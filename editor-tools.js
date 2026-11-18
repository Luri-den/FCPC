/* editor-tools.js - quality-of-life tools for the editor:
     Back to Map   a button in the top bar (asks first if there are unpublished changes)
     Search        find a grave or cemetery by name (same forgiving search as the live map) and jump to it
     Add Grave     if no cemetery is picked, it asks which one first, or offers to create a new cemetery
     Hover labels  on a computer, hovering a grave or cemetery shows its names and years, like the live map
   Load it after shell.js and name-search.js:  <script src="editor-tools.js"></script>
*/
(function () {
  "use strict";
  const mk = (tag, props, kids) => { const e = Object.assign(document.createElement(tag), props || {}); (kids || []).forEach(k => k != null && e.append(k)); return e; };
  const yearOf = v => { const m = String(v || "").match(/\b(1[5-9]\d\d|20\d\d)\b/); return m ? m[1] : ""; };
  const nameOf = r => [r["FIRST NAME"], r["LAST NAME"]].map(x => String(x || "").trim()).filter(Boolean).join(" ") || "Name unknown";
  const yearsOf = r => { const b = yearOf(r.BIRTH), d = yearOf(r.DEATH); return b || d ? " (" + (b || "?") + "–" + (d || "?") + ")" : ""; };
  const otherNames = r => String(r["OTHER_NAMES"] || r["OTHER NAMES"] || "").trim();
  const estOf = r => String(r.ESTABLISHED || r["EST."] || "").trim();
  const css = document.createElement("style");
  css.textContent =
    ".et-back{font-weight:600}" +
    ".et-search{position:relative;flex:1;min-width:150px;max-width:340px}.et-search input{width:100%;margin:0}" +
    ".et-res{position:absolute;top:100%;left:0;right:0;z-index:2000;background:#fff;color:#1a202c;border:1px solid #cbd2d9;border-radius:8px;box-shadow:0 8px 24px #0003;max-height:60vh;overflow:auto;margin-top:4px}" +
    ".et-res button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #edf0f3;background:#fff;color:inherit;padding:8px 10px;font:inherit;border-radius:0;cursor:pointer}" +
    ".et-res button:hover,.et-res button:focus{background:#f2f7f6}.et-res small{display:block;color:#6b7280;font-size:12px}.et-res .none{padding:10px;color:#6b7280}" +
    ".et-pick{margin:8px 0}.et-pick button{display:block;width:100%;text-align:left;margin:4px 0}" +
    ".et-hover .maplibregl-popup-content{padding:7px 10px;border-radius:8px;font-size:13px;line-height:1.35;box-shadow:0 2px 10px #0003}.et-hover .d{color:#6b7280;font-size:12px;white-space:pre-line}";
  document.head.append(css);

  /* ---------- Back to Map ---------- */
  const actions = document.querySelector(".ed-actions");
  if (actions) {
    const back = mk("button", { type: "button", className: "et-back", textContent: "← Back to Map", title: "Leave the editor and open the public map" });
    back.onclick = () => {
      if (typeof dirty !== "undefined" && dirty.size && !confirm("You have changes that haven't been published or saved. Leave the editor anyway? They will be lost.")) return;
      window.__etLeaving = true; location.href = "index.html";
    };
    actions.prepend(back);
  }
  window.addEventListener("beforeunload", e => { if (typeof dirty !== "undefined" && dirty.size && !window.__etLeaving) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Search ---------- */
  function goGrave(r) {
    sel = r.CEMETERY_ID; selG = r; setMode(null); refresh(); tab("grv");
    if (typeof ll === "function" && ll(r)) map.flyTo({ center: ll(r), zoom: Math.max(map.getZoom(), 19) });
  }
  function goCem(id) { pick(id); tab("cem"); }
  if (actions && window.NameSearch) {
    const wrap = mk("div", { className: "et-search" }), input = mk("input", { type: "search", placeholder: "Search graves or cemeteries", autocomplete: "off" }), res = mk("div", { className: "et-res", hidden: true });
    input.setAttribute("aria-label", "Search graves or cemeteries");
    wrap.append(input, res); actions.after(wrap);
    let timer = null;
    const run = () => {
      const q = input.value.trim(); res.textContent = ""; if (q.length < 2) { res.hidden = true; return; }
      const hits = [];
      cems.forEach(r => { const s = NameSearch.score(q, { names: (r.NAME || "") + " " + otherNames(r), other: (r.TOWNSHIP || "") + " " + (r.ID || "") }); if (s) hits.push({ s: s + 1, kind: "cem", r }); });
      ints.forEach(r => { const s = NameSearch.score(q, { names: nameOf(r), years: [r.BIRTH, r.DEATH], other: r.MARKER_ID || "" }); if (s) hits.push({ s, kind: "grv", r }); });
      hits.sort((a, b) => b.s - a.s);
      if (!hits.length) res.append(mk("div", { className: "none", textContent: "Nothing found" }));
      const cemName = id => (cems.find(c => c.ID === id) || {}).NAME || id || "no cemetery";
      hits.slice(0, 15).forEach(h => res.append(mk("button", { type: "button", onclick: () => { res.hidden = true; input.value = ""; h.kind === "cem" ? goCem(h.r.ID) : goGrave(h.r); } },
        h.kind === "cem" ? [mk("b", { textContent: h.r.NAME || h.r.ID }), mk("small", { textContent: "Cemetery · " + (h.r.ID || "") + (otherNames(h.r) ? " · also " + otherNames(h.r) : "") })]
                         : [mk("b", { textContent: nameOf(h.r) + yearsOf(h.r) }), mk("small", { textContent: "Grave · " + cemName(h.r.CEMETERY_ID) + (h.r.MARKER_ID ? " · " + h.r.MARKER_ID : "") })])));
      if (hits.length > 15) res.append(mk("div", { className: "none", textContent: "and " + (hits.length - 15) + " more: type more of the name" }));
      res.hidden = false;
    };
    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 120); });
    input.addEventListener("keydown", e => { if (e.key === "Escape") { res.hidden = true; input.blur(); } if (e.key === "Enter") { const b = res.querySelector("button"); if (b) b.click(); } });
    document.addEventListener("click", e => { if (!wrap.contains(e.target)) res.hidden = true; });
  }

  /* ---------- Add Grave: pick the cemetery first ---------- */
  const _drawGrv = window.drawGrv;
  if (typeof _drawGrv === "function") window.drawGrv = drawGrv = function () {
    if (cem()) return _drawGrv.apply(this, arguments);
    const box = document.getElementById("gdet"); box.textContent = "";
    const filter = mk("input", { type: "search", placeholder: "Type part of a cemetery name" }), list = mk("div", { className: "et-pick" });
    const fill = () => {
      list.textContent = ""; const q = filter.value.trim();
      cems.filter(r => !q || NameSearch.score(q, { names: (r.NAME || "") + " " + otherNames(r), other: r.ID || "" })).slice(0, 60)
        .forEach(r => list.append(mk("button", { type: "button", textContent: (r.NAME || r.ID) + " (" + ints.filter(x => x.CEMETERY_ID === r.ID).length + " people)", onclick: () => { pick(r.ID); tab("grv"); const c = cem(); if (c && ll(c)) map.flyTo({ center: ll(c), zoom: Math.max(map.getZoom(), 17) }); } })));
    };
    filter.addEventListener("input", fill); fill();
    box.append(mk("h3", { textContent: "Which cemetery?" }), mk("small", { textContent: "Pick the cemetery to add or edit graves in, or create a new one." }), filter, list,
      mk("button", { type: "button", className: "go", textContent: "+ Create New Cemetery", onclick: () => { tab("cem"); setMode("addCem", "Click on the map where the new cemetery is."); } }));
  };

  /* ---------- Hover labels (computers with a mouse) ---------- */
  if (window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches && typeof map !== "undefined") {
    let pop = null;
    const show = (lngLat, title, detail) => {
      if (!pop) pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: "280px", className: "et-hover" });
      const t = mk("div"); t.append(mk("b", { textContent: title })); if (detail) t.append(mk("div", { className: "d", textContent: detail }));
      pop.setLngLat(lngLat).setDOMContent(t).addTo(map);
    };
    const hide = () => { if (pop) pop.remove(); map.getCanvas().style.cursor = ""; };
    const hookLayers = () => {
      if (!map.getLayer("gr") || hookLayers.done) return; hookLayers.done = true;
      map.on("mousemove", "gr", e => {
        const f = e.features && e.features[0]; if (!f) return; map.getCanvas().style.cursor = "pointer";
        const r = ints[f.properties.i]; if (!r) return;
        const same = r.MARKER_ID ? ints.filter(x => x.CEMETERY_ID === r.CEMETERY_ID && x.MARKER_ID === r.MARKER_ID) : [r];
        show(f.geometry.coordinates, nameOf(same[0]) + yearsOf(same[0]), same.slice(1).map(x => nameOf(x) + yearsOf(x)).join("\n") + (r.MARKER_ID ? (same.length > 1 ? "\n" : "") + r.MARKER_ID : ""));
      });
      map.on("mousemove", "cems", e => {
        const f = e.features && e.features[0]; if (!f) return; map.getCanvas().style.cursor = "pointer";
        const r = cems.find(x => x.ID === f.properties.id); if (!r) return;
        const est = estOf(r), last = Math.max(0, ...ints.filter(x => x.CEMETERY_ID === r.ID).map(x => +yearOf(x.DEATH) || 0)), facts = [];
        if (est && +est > 0) facts.push("Est. " + est); if (last) facts.push("Last Burial: " + last);
        const other = otherNames(r);
        show(f.geometry.coordinates, r.NAME || r.ID, [other && !/^none( known)?$/i.test(other) ? other : "", facts.length ? "(" + facts.join(" · ") + ")" : ""].filter(Boolean).join("\n"));
      });
      map.on("mouseleave", "gr", hide); map.on("mouseleave", "cems", hide);
    };
    if (map.loaded && map.loaded()) hookLayers();
    map.on("load", hookLayers); map.on("idle", hookLayers);
  }

  /* ---------- File > Import Lost Cemeteries: turns the old lake file (lakecems.csv) into ordinary relocated cemeteries ---------- */
  const fileMenu = document.querySelector(".ed-actions .ed-menu");
  async function readSiteText(name) {
    try { const r = await fetch(new URL(name, document.baseURI).href, { cache: "no-store" }); if (r.ok) return await r.text(); } catch (e) {}
    try { if (window.GHPublish && GHPublish.configured() && GHPublish.hasKey()) return await GHPublish.read(name); } catch (e) {}
    return null;
  }
  async function importLost() {
    if (!cems.length) return say("Open a map first.");
    const file = (S.lostSites && S.lostSites.file) || "lakecems.csv", text = await readSiteText(file);
    if (!text) return say("No " + file + " was found on the published site, so there is nothing to import.");
    const rows = Papa.parse(text.replace(/^\ufeff/, ""), { header: true, skipEmptyLines: true }).data;
    const reason = /lake|reservoir/i.test((S.lostSites && (S.lostSites.title + " " + S.lostSites.intro)) || "lake") ? "Lake / Reservoir Construction" : "Other / Unknown";
    ["SITE_STATUS", "RELOCATION_REASON", "RELOCATED_TO", "RELOCATION_YEAR"].forEach(f => { if (!cemF.includes(f)) cemF.push(f); });
    let added = 0, skipped = 0;
    rows.forEach(x => {
      const id = String(x["LOST CEM ID"] || "").trim(); if (!id) return;
      if (cems.some(c => c.ID === id)) { skipped++; return; }
      const row = {}; cemF.forEach(f => row[f] = "");
      const notes = [x.NOTES, x["MOVED TO"] && !x["MOVE ID"] ? "Moved to: " + x["MOVED TO"] : "", x.DESIGNATION ? "Designation: " + x.DESIGNATION : "", x["TRACT NO."] ? "Tract: " + x["TRACT NO."] : ""].filter(Boolean).join(" ");
      Object.assign(row, { ID: id, NAME: x.NAME || id, OTHER_NAMES: x["ALTERNATE NAME"] || "", TOWNSHIP: x.TOWNSHIP || "", LAT: x.LAT || "", LONG: x.LONG || "",
        SITE_STATUS: "Relocated", RELOCATION_REASON: reason, RELOCATED_TO: String(x["MOVE ID"] || "").trim(), LOCATION_DETAILS: x["RECORDED LOCATION"] || "", PUBLIC_NOTES: notes });
      cems.push(row); added++;
    });
    if (!added) return say("Nothing new to import" + (skipped ? ": all " + skipped + " are already in the cemetery list." : "."));
    touch("cem");
    if (S.lostSites) { delete S.lostSites; touch("settings"); }   // otherwise the map would show them twice: the old lake marker and the new ones
    refresh();
    say("Imported " + added + " relocated cemeteries" + (skipped ? " (" + skipped + " were already there)" : "") + ". The old lake marker is turned off. Check them on the Cemeteries tab, then Publish. " + file + " can be deleted after publishing.");
  }
  if (fileMenu) { const b = mk("button", { type: "button", textContent: "Import Lost Cemeteries", onclick: importLost }); b.append(mk("small", { textContent: "Turn an old lake file (lakecems.csv) into relocated cemeteries" })); fileMenu.append(b); }

  /* ---------- the live map's icons in the editor ---------- */
  if (typeof map !== "undefined" && window.MapSymbols) {
    const C = () => Object.assign({ inaccessible: "#8B0000", private: "#D2691E", permission: "#C9A227", public: "#01796F", unknown: "#777777", grave: "#3f3528" }, (S && S.colors) || {});
    const paint = () => {
      if (!map.getLayer("cems")) return;
      const c = C();
      map.setPaintProperty("cems", "circle-color", ["case", ["==", ["get", "s"], 1], "#2563eb", ["match", ["get", "a"], 0, c.inaccessible, 1, c.private, 2, c.permission, 3, c.public, c.unknown]]);
    };
    const setup = () => {
      if (!map.getLayer("gr") || map.getLayer("gr-sym")) return;
      MapSymbols.register(map, C().grave);
      // graves: the same drawings as the live map; the old dots stay underneath, invisible, so clicking and hovering still work
      map.setPaintProperty("gr", "circle-opacity", 0); map.setPaintProperty("gr", "circle-stroke-opacity", 0);
      map.addLayer({ id: "gr-sym", type: "symbol", source: "gr", layout: {
        "icon-image": ["concat", ["case", ["==", ["get", "m"], 1], "grave-square", "grave-circle"], ["case", [">", ["get", "n"], 1], "-dot", ""], ["case", ["==", ["get", "v"], 1], "-vet", ""], ["case", ["==", ["get", "p"], 1], "-pio", ""]],
        "icon-allow-overlap": true, "icon-ignore-placement": true } });
      // cemeteries: the access marks, and a wave or an arrow on relocated ones
      map.addLayer({ id: "cems-mark", type: "symbol", source: "cems",
        filter: ["any", ["==", ["get", "s"], 1], ["in", ["get", "a"], ["literal", [0, 1, 2]]]],
        layout: { "icon-image": ["case", ["==", ["get", "s"], 1], ["case", ["==", ["get", "w"], 1], "access-mark-waves", "access-mark-arrow"],
          ["match", ["get", "a"], 0, "access-mark-inaccessible", 1, "access-mark-private", "access-mark-permission"]], "icon-size": 0.45, "icon-allow-overlap": true, "icon-ignore-placement": true } });
      paint();
    };
    const _refresh2 = window.refresh;
    if (typeof _refresh2 === "function") window.refresh = refresh = function () { const r = _refresh2.apply(this, arguments); try { setup(); paint(); } catch (e) {} return r; };
    map.on("load", setup); map.on("idle", setup);
  }
})();
