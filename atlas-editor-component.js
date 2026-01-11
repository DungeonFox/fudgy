/* Atlas Editor Web Component (no-server / file:// friendly)
   Defines <atlas-editor> custom element.
   - No external dependencies
   - No fetch: pass atlas via property (el.atlas = obj) or attribute atlas-script="#atlas-data"
   - Emits 'groupButtonClick' on the element (bubbles + composed)
*/
(function() {
  const TEMPLATE = document.createElement("template");
  TEMPLATE.innerHTML = "<style>\n  :host {\n    display: block;\n    width: 100%;\n    height: 100%;\n    box-sizing: border-box;\n  }\n  *, *::before, *::after { box-sizing: inherit; }\n\n\n  :host {\n    --bg: #0b0d10;\n    --panel: #12151a;\n    --panel2: #171b22;\n    --fg: #e6e8ee;\n    --muted: #9aa3b2;\n    --accent: #77a7ff;\n    --border: rgba(255,255,255,.12);\n  }\n  :host {\n    height: 100%;\n    margin: 0;\n    background: var(--bg);\n    color: var(--fg);\n    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;\n  }\n  .wrap {\n    display: grid;\n    grid-template-columns: 360px 1fr;\n    height: 100%;\n  }\n  .panel {\n    background: var(--panel);\n    border-right: 1px solid var(--border);\n    overflow: auto;\n    padding: 14px 14px 18px;\n  }\n  .panel h1 {\n    font-size: 14px;\n    margin: 0 0 10px;\n    font-weight: 650;\n    letter-spacing: .2px;\n  }\n  .panel p {\n    margin: 0 0 12px;\n    font-size: 12px;\n    color: var(--muted);\n    line-height: 1.35;\n  }\n  .group {\n    background: var(--panel2);\n    border: 1px solid var(--border);\n    border-radius: 10px;\n    padding: 10px;\n    margin: 10px 0;\n  }\n  .group header {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 10px;\n    margin-bottom: 8px;\n  }\n  .group header .title {\n    font-weight: 650;\n    font-size: 12px;\n  }\n  .row {\n    display: grid;\n    grid-template-columns: 1fr 1fr;\n    gap: 8px;\n  }\n  label {\n    display: grid;\n    gap: 4px;\n    font-size: 11px;\n    color: var(--muted);\n  }\n  input[type=\"number\"], input[type=\"text\"], textarea, select {\n    width: 100%;\n    box-sizing: border-box;\n    background: rgba(0,0,0,.25);\n    color: var(--fg);\n    border: 1px solid var(--border);\n    border-radius: 8px;\n    padding: 6px 8px;\n    outline: none;\n    font-size: 12px;\n  }\n  textarea {\n    min-height: 64px;\n    resize: vertical;\n    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", monospace;\n    line-height: 1.25;\n  }\n  .checks {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 10px;\n    margin-top: 6px;\n  }\n  .checks label {\n    display: flex;\n    align-items: center;\n    gap: 6px;\n    color: var(--fg);\n    font-size: 12px;\n  }\n  .checks input {\n    transform: translateY(1px);\n  }\n  .stage {\n    position: relative;\n    overflow: hidden;\n  }\n  #stage {\n    width: 100%;\n    height: 100%;\n    display: block;\n  }\n  .badge {\n    font-size: 11px;\n    color: var(--muted);\n  }\n  .toolbar {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 10px;\n    margin: 10px 0 6px;\n    padding: 8px 10px;\n    border: 1px solid var(--border);\n    border-radius: 10px;\n    background: rgba(255,255,255,.03);\n  }\n  .toolbar .right {\n    display: flex;\n    gap: 10px;\n    align-items: center;\n  }\n  button {\n    background: rgba(255,255,255,.06);\n    color: var(--fg);\n    border: 1px solid var(--border);\n    border-radius: 10px;\n    padding: 7px 10px;\n    cursor: pointer;\n    font-size: 12px;\n  }\n  button:hover {\n    border-color: rgba(255,255,255,.22);\n  }\n  .miniBtn {\n    padding: 5px 8px;\n    border-radius: 9px;\n    font-size: 11px;\n  }\n  .small {\n    font-size: 11px;\n    color: var(--muted);\n  }\n\n/* --- UI selection + button-group affordances --- */\n.group.selected {\n  border-color: rgba(119,167,255,.65);\n  box-shadow: 0 0 0 1px rgba(119,167,255,.25) inset;\n}\n.group header { cursor: pointer; }\n.group header button { cursor: pointer; }\n\n/* SVG button groups (rendered inside the stage) */\n.uiButton:hover rect { stroke: rgba(255,255,255,.35); }\n.uiButton:focus rect { stroke: rgba(119,167,255,.85); stroke-width: 2; }\n\n\n/* SVG content hitboxes (text rendered as a button) */\n.contentButton { cursor: pointer; }\n.contentButton:focus { outline: none; }\n.contentButton:hover .contentHit { stroke: rgba(255,255,255,.35); }\n.contentButton:focus-within .contentHit { stroke: rgba(119,167,255,.85); stroke-width: 2; }\n.contentHit { fill: rgba(0,0,0,0); stroke: rgba(255,255,255,0); stroke-width: 1; pointer-events: all; }\n\n</style>\n<div class=\"wrap\">\n<div class=\"panel\">\n<h1>Per-group edges + word wrap + fixed line bottoms (offline SVG)</h1>\n<p>\n      Each group has its own area edges (L/R/T/B from the group origin), its own wrap/shrink rules, and its own fixed\n      line-bottom positions. With left alignment and fixed line bottoms, shrinking the right boundary should not \u201cdrift\u201d the block.\n    </p>\n<div class=\"toolbar\">\n<div class=\"badge\" id=\"fontBadge\"></div>\n<div class=\"right\">\n<label style=\"display:flex;align-items:center;gap:6px;color:var(--fg);font-size:12px;\">\n<input id=\"globalGuides\" type=\"checkbox\"/> Global guides\n        </label>\n<button id=\"rerenderBtn\" type=\"button\">Re-render</button>\n<label style=\"display:flex;align-items:center;gap:6px;color:var(--fg);font-size:12px;\">\n<span class=\"small\" style=\"color:var(--muted);\">Template</span>\n<select id=\"addGroupTemplate\" title=\"Template for new group\"></select>\n</label>\n<button id=\"addGroupBtn\" type=\"button\">Add group</button>\n</div>\n</div>\n<div id=\"groupsUI\"></div>\n<p class=\"small\">\n      Notes: This atlas is ASCII-only (U+0020..U+007E). Curly quotes/dashes/ellipsis are normalized to ASCII; everything else falls back to '?'.\n      Wrapping is word-based (spaces). If a single word cannot fit in the available width, you can choose \u201cbreak long words\u201d or force shrink.\n    </p>\n</div>\n<div class=\"stage\">\n<svg id=\"stage\" xmlns=\"http://www.w3.org/2000/svg\"></svg>\n</div>\n</div>\n\n\n";

  function initAtlasEditor(host, root, atlas) {
    const cleanupFns = [];
    const byId = (id) => root.querySelector("#" + id);
    if (!host.GROUP_ACTIONS || typeof host.GROUP_ACTIONS !== "object") host.GROUP_ACTIONS = {};
    if (host.dispatchToWindow == null) host.dispatchToWindow = false;

// ---------------- Button action hooks ----------------
  // You can register handlers in two ways:
  //  1) registerGroupAction(groupId, fn)   // per-group direct handler
  //  2) window.GROUP_ACTIONS[actionKey] = fn  // named actions (group.actionKey points to one)
  //
  // Handlers receive: { groupId, group, source, payload, originalEvent }
  const __GROUP_ACTIONS = new Map();

  host.registerGroupAction = function registerGroupAction(groupId, fn) {
    if (!groupId) throw new Error("registerGroupAction: groupId required");
    if (typeof fn !== "function") throw new Error("registerGroupAction: fn must be a function");
    __GROUP_ACTIONS.set(String(groupId), fn);
    return () => __GROUP_ACTIONS.delete(String(groupId));
  };

  host.unregisterGroupAction = function unregisterGroupAction(groupId) {
    __GROUP_ACTIONS.delete(String(groupId));
  };

  window.clearGroupActions = function clearGroupActions() {
    __GROUP_ACTIONS.clear();
  };

  function parseActionPayload(group) {
    const raw = (group && typeof group.actionPayload === "string") ? group.actionPayload.trim() : "";
    if (!raw) return undefined;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  function safeCall(fn, detail) {
    try { fn(detail); }
    catch (err) { console.error("[group action] handler threw:", err); }
  }

  function handleGroupPress(group, source, originalEvent) {
    if (!group || !group.id) return;

    // Keep editor behavior: selecting the group is always the first thing.
    if (typeof setSelectedGroupId === "function") setSelectedGroupId(group.id, { scroll: false });

    const payload = parseActionPayload(group);
    const detail = {
      groupId: group.id,
      group,
      source: source || "unknown",
      payload,
      originalEvent
    };

    // 1) Direct per-group handler (highest priority)
    const direct = __GROUP_ACTIONS.get(String(group.id));
    if (typeof direct === "function") {
      safeCall(direct, detail);
    } else {
      // 2) Named action (by group.actionKey or group.id)
      const actions = (typeof host.GROUP_ACTIONS === "object" && host.GROUP_ACTIONS) ? host.GROUP_ACTIONS : ((typeof window.GROUP_ACTIONS === "object" && window.GROUP_ACTIONS) ? window.GROUP_ACTIONS : null);
      const key = (group.actionKey || "").toString().trim();
      const named = actions && (actions[group.id] || (key ? actions[key] : undefined));
      if (typeof named === "function") safeCall(named, detail);
      else if (typeof host.onGroupButtonClick === "function") safeCall(host.onGroupButtonClick, detail);
      else if (typeof window.onGroupButtonClick === "function") safeCall(window.onGroupButtonClick, detail);
    }

    // Always also emit an event (useful for external observers)
    host.dispatchEvent(new CustomEvent("groupButtonClick", { detail: { groupId: group.id, source: source || "unknown", payload }, bubbles: true, composed: true }));
    if (host.dispatchToWindow) window.dispatchEvent(new CustomEvent("groupButtonClick", { detail: { groupId: group.id, source: source || "unknown", payload } }));
  }

  const ATLAS = atlas;
  if (!ATLAS || !ATLAS.glyphs) throw new Error("AtlasEditor: missing atlas data");

  const stage = byId("stage");
  const renderAtlasGroups = (window.AtlasSvgRenderer && window.AtlasSvgRenderer.renderAtlasGroups) || window.renderAtlasGroups;
  if (typeof renderAtlasGroups !== "function") throw new Error("AtlasEditor: missing renderAtlasGroups (load js/atlas_svg_renderer.js)");

  const badge = byId("fontBadge");
  badge.textContent = `${ATLAS.font.family} — unitsPerEm=${ATLAS.font.unitsPerEm} (ASCII demo)`;

  function render() {
    // Stage size
    const rect = stage.getBoundingClientRect();
    const globalGuides = byId("globalGuides").checked;

    renderAtlasGroups({
      svgEl: stage,
      atlas: ATLAS,
      groups: GROUPS,
      viewBoxSize: { width: Math.max(1, rect.width), height: Math.max(1, rect.height) },
      globalGuides,
      selectedGroupId: SELECTED_GROUP_ID,
      onGroupAction: ({ group, source, originalEvent }) => {
        handleGroupPress(group, source, originalEvent);
      }
    });
  }

  // ---------------- Groups (per-group controls) ----------------

  let GROUPS = [
    {
      id: "title",
      name: "Title (single line, shrink only)",
      originX: 560,
      originY: 120,
      areaL: 520,
      areaR: 520,
      areaT: 70,
      areaB: 70,

      paddingPx: 10,
      lineGapPx: 0,
      trackingUnits: 20,

      allowWrap: false,
      maxLines: 1,
      breakLongWords: false,

      // Fixed line bottoms relative to group originY (px)
      lineBottomOffsetsPx: [40],

      align: "left",
      hOffsetPx: 0,

      pixelSnap: true,
      showGuides: false,
      opacity: 1,
      uiRole: "text",
      contentAsButton: false,
      text: "CHEST OF STARS — TEST TITLE"
    },
    {
      id: "rules",
      name: "Rules (word wrap, fixed line bottoms)",
      originX: 560,
      originY: 360,
      areaL: 520,
      areaR: 520,
      areaT: 200,
      areaB: 200,

      paddingPx: 12,
      lineGapPx: 4,
      trackingUnits: 6,

      allowWrap: true,
      maxLines: 6,
      breakLongWords: true,

      lineBottomOffsetsPx: [-70, -30, 10, 50, 90, 130],

      align: "left",
      hOffsetPx: 0,

      pixelSnap: true,
      showGuides: false,
      opacity: 1,
      uiRole: "text",
      contentAsButton: false,
      text: "When this enters play, draw two cards. If you drew a card this turn, gain 3 life. Use word wrap by spaces; shrink only when the fixed line bottoms cannot accommodate the wrapped lines."
    },
    {
      id: "flavor",
      name: "Flavor (wrap + max lines)",
      originX: 560,
      originY: 560,
      areaL: 520,
      areaR: 520,
      areaT: 120,
      areaB: 120,

      paddingPx: 12,
      lineGapPx: 3,
      trackingUnits: 6,

      allowWrap: true,
      maxLines: 3,
      breakLongWords: false,

      lineBottomOffsetsPx: [-40, 0, 40],

      align: "left",
      hOffsetPx: 0,

      pixelSnap: true,
      showGuides: false,
      opacity: 0.9,
      uiRole: "text",
      contentAsButton: false,
      text: "“The map is not the territory— but it does make a great treasure.”"
    }
  ];

  let SELECTED_GROUP_ID = GROUPS[0] ? GROUPS[0].id : null;

  // Build UI
  const ui = byId("groupsUI");

  function mkEl(tag, attrs={}, children=[]) {
    const el = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v);
    }
    for (const c of children) el.appendChild(c);
    return el;
  }

  function inputNumber(value, step="1") {
    const i = document.createElement("input");
    i.type = "number";
    i.step = step;
    i.value = String(value);
    return i;
  }

  function inputText(value) {
    const i = document.createElement("input");
    i.type = "text";
    i.value = value;
    return i;
  }

  function inputCheckbox(value) {
    const i = document.createElement("input");
    i.type = "checkbox";
    i.checked = !!value;
    return i;
  }

  function inputSelect(value, options) {
    const s = document.createElement("select");
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (opt === value) o.selected = true;
      s.appendChild(o);
    }
    return s;
  }

  function parseOffsets(s) {
    const out = [];
    for (const part of s.split(",")) {
      const t = part.trim();
      if (!t) continue;
      const n = Number(t);
      if (Number.isFinite(n)) out.push(n);
    }
    return out;
  }

  // Group management (add / delete / duplicate)
  function cloneGroup(g) {
    if (typeof structuredClone === "function") return structuredClone(g);
    return JSON.parse(JSON.stringify(g));
  }

  function uniqueGroupId(base) {
    base = (base || "group").toString();
    const used = new Set(GROUPS.map(g => g.id));
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(`${base}${n}`)) n++;
    return `${base}${n}`;
  }

  function newDefaultGroup() {
    // Reasonable defaults (matching the demo groups) — tweak as needed.
    return {
      id: uniqueGroupId("group"),
      name: `Group ${GROUPS.length + 1}`,
      originX: 560,
      originY: 560,
      areaL: 520,
      areaR: 520,
      areaT: 120,
      areaB: 120,
      paddingPx: 12,
      lineGapPx: 3,
      trackingUnits: 6,
      allowWrap: true,
      maxLines: 3,
      breakLongWords: false,
      lineBottomOffsetsPx: [-40, 0, 40],
      align: "left",
      hOffsetPx: 0,
      pixelSnap: true,
      showGuides: false,
      opacity: 0.9,
      uiRole: "text",
      contentAsButton: false,
      text: ""
    };
  }

  function addGroup() {
  // Add a new group based on a chosen template:
  // - Default (blank)
  // - Any currently loaded group (layout template)
  const sel = byId("addGroupTemplate");
  const templateId = sel ? sel.value : "__default__";

  let base;
  if (templateId === "__default__") {
    base = newDefaultGroup();
  } else {
    const tpl = GROUPS.find(g => g.id === templateId);
    base = tpl ? cloneGroup(tpl) : newDefaultGroup();
  }

  base.id = uniqueGroupId((base.id || "group").toString());
  base.name = `Group ${GROUPS.length + 1}`;

  // Nudge so new groups don't perfectly overlap the template.
  base.originX = Number(base.originX || 0) + 30;
  base.originY = Number(base.originY || 0) + 30;

  // New groups should start blank so the user can define them before anything renders.
  base.text = "";

  GROUPS.push(base);
  setSelectedGroupId(base.id);
}

function duplicateGroup(idx) {
    const g = GROUPS[idx];
    if (!g) return;
    const copy = cloneGroup(g);
    copy.id = uniqueGroupId((g.id || "group") + "_copy");
    copy.name = (g.name || "Group") + " (copy)";
    copy.originX = Number(copy.originX || 0) + 20;
    copy.originY = Number(copy.originY || 0) + 20;
    GROUPS.splice(idx + 1, 0, copy);
    setSelectedGroupId(copy.id);
  }

  function deleteGroup(idx) {
    const g = GROUPS[idx];
    if (!g) return;
    if (GROUPS.length <= 1) return; // keep at least one group
    const ok = window.confirm(`Delete group "${g.name}"?`);
    if (!ok) return;
const deletedId = g.id;
GROUPS.splice(idx, 1);

const next = GROUPS[Math.min(idx, GROUPS.length - 1)];
const nextId = next ? next.id : null;

if (SELECTED_GROUP_ID === deletedId) {
  setSelectedGroupId(nextId, { scroll: false });
} else {
  buildUI();
  render();
}
  }


  function buildGroupUI(group, idx) {
    const box = mkEl("div", { class: "group", "data-group-id": group.id });
    if (group.id === SELECTED_GROUP_ID) box.classList.add("selected");

    const header = mkEl("header");
    const titleWrap = mkEl("div", { style: "display:flex;flex-direction:column;gap:2px;min-width:0;" });
    titleWrap.appendChild(mkEl("div", { class: "title", text: group.name }));
    titleWrap.appendChild(mkEl("div", { class: "small", text: `id: ${group.id}` }));
    header.appendChild(titleWrap);

    const actions = mkEl("div", { style: "display:flex;gap:6px;align-items:center;" });
    const selBtn = mkEl("button", { type: "button", class: "miniBtn", text: "Select" });
    const dupBtn = mkEl("button", { type: "button", class: "miniBtn", text: "Duplicate" });
    const delBtn = mkEl("button", { type: "button", class: "miniBtn", text: "Delete" });
    actions.appendChild(selBtn);
    actions.appendChild(dupBtn);
    actions.appendChild(delBtn);
    header.appendChild(actions);
    box.appendChild(header);

    header.addEventListener("click", () => setSelectedGroupId(group.id, { scroll: false }));

    selBtn.addEventListener("click", (e) => { e.stopPropagation(); setSelectedGroupId(group.id); });
    dupBtn.addEventListener("click", (e) => { e.stopPropagation(); duplicateGroup(idx); });
    delBtn.addEventListener("click", (e) => { e.stopPropagation(); deleteGroup(idx); });

    // Type + opacity (handy for both text and buttons)
    const row0 = mkEl("div", { class: "row" });
    const uiRole = inputSelect(group.uiRole || "text", ["text","button"]);
    const op = inputNumber(group.opacity ?? 1, "0.05");
    row0.appendChild(mkEl("label", {}, [mkEl("span", {text:"uiRole"}), uiRole]));
    row0.appendChild(mkEl("label", {}, [mkEl("span", {text:"opacity"}), op]));
    box.appendChild(row0);

    const typeHint = mkEl("div", { class: "small", text: "" });
    function refreshHint() {
      if ((group.uiRole || "text") === "button") {
        typeHint.textContent = "Button mode: renders a clickable SVG button using this group's area. Label comes from 'text'. Empty labels render nothing unless guides are on.";
      } else {
        typeHint.textContent = "";
      }
    }
    refreshHint();
    box.appendChild(typeHint);

    const row1 = mkEl("div", { class: "row" });
    const ox = inputNumber(group.originX, "1");
    const oy = inputNumber(group.originY, "1");
    row1.appendChild(mkEl("label", { }, [mkEl("span", {text:"originX"}), ox]));
    row1.appendChild(mkEl("label", { }, [mkEl("span", {text:"originY"}), oy]));
    box.appendChild(row1);

    const row2 = mkEl("div", { class: "row" });
    const aL = inputNumber(group.areaL, "1");
    const aR = inputNumber(group.areaR, "1");
    const aT = inputNumber(group.areaT, "1");
    const aB = inputNumber(group.areaB, "1");
    row2.appendChild(mkEl("label", {}, [mkEl("span", {text:"areaL"}), aL]));
    row2.appendChild(mkEl("label", {}, [mkEl("span", {text:"areaR"}), aR]));
    const row3 = mkEl("div", { class: "row" });
    row3.appendChild(mkEl("label", {}, [mkEl("span", {text:"areaT"}), aT]));
    row3.appendChild(mkEl("label", {}, [mkEl("span", {text:"areaB"}), aB]));
    box.appendChild(row2);
    box.appendChild(row3);

    const row4 = mkEl("div", { class: "row" });
    const pad = inputNumber(group.paddingPx, "1");
    const gap = inputNumber(group.lineGapPx, "1");
    row4.appendChild(mkEl("label", {}, [mkEl("span", {text:"paddingPx"}), pad]));
    row4.appendChild(mkEl("label", {}, [mkEl("span", {text:"lineGapPx"}), gap]));
    box.appendChild(row4);

    const row5 = mkEl("div", { class: "row" });
    const track = inputNumber(group.trackingUnits, "1");
    const maxL = inputNumber(group.maxLines, "1");
    row5.appendChild(mkEl("label", {}, [mkEl("span", {text:"trackingUnits"}), track]));
    row5.appendChild(mkEl("label", {}, [mkEl("span", {text:"maxLines"}), maxL]));
    box.appendChild(row5);

    const row6 = mkEl("div", { class: "row" });
    const align = inputSelect(group.align, ["left","center","right"]);
    const hOff = inputNumber(group.hOffsetPx, "1");
    row6.appendChild(mkEl("label", {}, [mkEl("span", {text:"align"}), align]));
    row6.appendChild(mkEl("label", {}, [mkEl("span", {text:"hOffsetPx"}), hOff]));
    box.appendChild(row6);

    const offsets = inputText(group.lineBottomOffsetsPx.join(", "));
    box.appendChild(mkEl("label", {}, [mkEl("span", {text:"lineBottomOffsetsPx (comma-separated, relative to originY)"}), offsets]));

    const checks = mkEl("div", { class: "checks" });
    const allowWrap = inputCheckbox(group.allowWrap);
    const breakLong = inputCheckbox(group.breakLongWords);
    const snap = inputCheckbox(group.pixelSnap);
    const guides = inputCheckbox(group.showGuides);
    const contentBtn = inputCheckbox(group.contentAsButton);

    checks.appendChild(mkEl("label", {}, [allowWrap, mkEl("span", {text:"allowWrap"})]));
    checks.appendChild(mkEl("label", {}, [breakLong, mkEl("span", {text:"breakLongWords"})]));
    checks.appendChild(mkEl("label", {}, [snap, mkEl("span", {text:"pixelSnap"})]));
    checks.appendChild(mkEl("label", {}, [guides, mkEl("span", {text:"showGuides"})]));
    checks.appendChild(mkEl("label", {}, [contentBtn, mkEl("span", {text:"contentAsButton"})]));
    box.appendChild(checks);

    const ta = document.createElement("textarea");
    ta.value = group.text;
    box.appendChild(mkEl("label", {}, [mkEl("span", {text:"text"}), ta]));

    const actionKey = inputText(group.actionKey || "");
    box.appendChild(mkEl("label", {}, [mkEl("span", {text:"onClick actionKey (optional; maps to window.GROUP_ACTIONS[key])"}), actionKey]));

    const payloadTa = document.createElement("textarea");
    payloadTa.value = (group.actionPayload || "");
    payloadTa.style.minHeight = "42px";
    box.appendChild(mkEl("label", {}, [mkEl("span", {text:"actionPayload (optional; JSON or plain text)"}), payloadTa]));


    function bind() {
      group.uiRole = uiRole.value;
      group.opacity = Math.max(0, Math.min(1, Number(op.value)));

      group.originX = Number(ox.value);
      group.originY = Number(oy.value);
      group.areaL = Number(aL.value);
      group.areaR = Number(aR.value);
      group.areaT = Number(aT.value);
      group.areaB = Number(aB.value);
      group.paddingPx = Number(pad.value);
      group.lineGapPx = Number(gap.value);
      group.trackingUnits = Number(track.value);
      group.maxLines = Math.max(1, Number(maxL.value));
      group.align = align.value;
      group.hOffsetPx = Number(hOff.value);
      group.lineBottomOffsetsPx = parseOffsets(offsets.value);
      group.allowWrap = allowWrap.checked;
      group.breakLongWords = breakLong.checked;
      group.pixelSnap = snap.checked;
      group.showGuides = guides.checked;
      group.contentAsButton = contentBtn.checked;
      group.text = ta.value;
      {
        const k = actionKey.value.trim();
        if (k) group.actionKey = k;
        else delete group.actionKey;
      }
      {
        const raw = payloadTa.value;
        if (raw && raw.trim()) group.actionPayload = raw;
        else delete group.actionPayload;
      }


      refreshHint();
      render();
    }

    for (const el of [uiRole, op, ox,oy,aL,aR,aT,aB,pad,gap,track,maxL,align,hOff,offsets,allowWrap,breakLong,snap,guides,contentBtn,ta,actionKey,payloadTa]) {
      el.addEventListener("input", bind);
      el.addEventListener("change", bind);
    }

    return box;
  }


function updateAddGroupTemplateSelect() {
  const sel = byId("addGroupTemplate");
  if (!sel) return;

  const prev = sel.value || "__default__";
  sel.innerHTML = "";

  const o0 = document.createElement("option");
  o0.value = "__default__";
  o0.textContent = "Default (blank)";
  sel.appendChild(o0);

  for (const g of GROUPS) {
    const o = document.createElement("option");
    o.value = g.id;
    const name = (g.name || g.id || "Group").toString();
    o.textContent = `${name}  [${g.id}]`;
    sel.appendChild(o);
  }

  const exists = Array.from(sel.options).some(o => o.value === prev);
  sel.value = exists ? prev : "__default__";
}

  function buildUI() {
    ui.innerHTML = "";
    updateAddGroupTemplateSelect();
    GROUPS.forEach((g, idx) => ui.appendChild(buildGroupUI(g, idx)));
  }

  function setSelectedGroupId(id, opts = {}) {
    if (!id) return;
    if (SELECTED_GROUP_ID === id && opts.force !== true) return;

    SELECTED_GROUP_ID = id;
    buildUI();
    render();

    if (opts.scroll !== false) {
      const nodes = ui.querySelectorAll("[data-group-id]");
      for (const n of nodes) {
        if (n.getAttribute("data-group-id") === id) {
          n.scrollIntoView({ block: "nearest", behavior: "smooth" });
          break;
        }
      }
    }
  }

  buildUI();
  byId("rerenderBtn").addEventListener("click", render);
  byId("addGroupBtn").addEventListener("click", addGroup);
  const __onResize = () => render();
  window.addEventListener("resize", __onResize);
  cleanupFns.push(() => window.removeEventListener("resize", __onResize));

  // First render
  render();


    const clone = (v) => {
      try { return structuredClone(v); }
      catch { return JSON.parse(JSON.stringify(v)); }
    };

    host.getGroups = () => clone(GROUPS);
    host.setGroups = (groups) => {
      if (!Array.isArray(groups)) throw new Error("setGroups: expected an array");
      GROUPS = clone(groups);
      if (GROUPS.length && !GROUPS.some(g => g.id === selectedGroupId)) selectedGroupId = GROUPS[0].id;
      buildUI();
      render();
    };
    host.getSelectedGroupId = () => selectedGroupId;
    host.setSelectedGroupId = (id, opts) => setSelectedGroupId(String(id), opts);

    return {
      destroy() {
        cleanupFns.forEach(fn => {
          try { fn(); } catch (e) {}
        });
      }
    };
  }

  class AtlasEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._booted = false;
      this._instance = null;
      this._atlas = null;
      this.dispatchToWindow = false;
      this.GROUP_ACTIONS = {};
    }

    set atlas(v) {
      this._atlas = v;
      if (this._booted) this._reboot();
    }
    get atlas() { return this._atlas; }

    connectedCallback() {
      if (this._booted) return;
      this._booted = true;
      this._reboot();
    }

    disconnectedCallback() {
      if (this._instance && this._instance.destroy) this._instance.destroy();
      this._instance = null;
      this._booted = false;
    }

    _readAtlasFromLightDom() {
      const sel = this.getAttribute("atlas-script");
      if (sel) {
        const el = document.querySelector(sel);
        if (el) {
          const txt = (el.textContent || "").trim();
          if (txt) return JSON.parse(txt);
        }
      }
      const inner = this.querySelector('script[type="application/json"]');
      if (inner) {
        const txt = (inner.textContent || "").trim();
        if (txt) return JSON.parse(txt);
      }
      return null;
    }

    _reboot() {
      if (this._instance && this._instance.destroy) this._instance.destroy();
      this._instance = null;

      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(TEMPLATE.content.cloneNode(true));

      let atlas = this._atlas;
      if (!atlas) {
        try { atlas = this._readAtlasFromLightDom(); } catch (e) {
          console.error("AtlasEditor: failed to parse atlas JSON", e);
        }
      }
      if (!atlas) {
        const panel = this.shadowRoot.querySelector(".panel");
        if (panel) {
          const msg = document.createElement("div");
          msg.style.marginTop = "10px";
          msg.style.padding = "10px";
          msg.style.border = "1px solid var(--border)";
          msg.style.background = "var(--panel2)";
          msg.style.borderRadius = "10px";
          msg.style.color = "var(--muted)";
          msg.textContent = 'No atlas provided. Set el.atlas = <object> or add atlas-script="#atlas-data" pointing to a <script type="application/json">.';
          panel.appendChild(msg);
        }
        return;
      }

      try {
        this._instance = initAtlasEditor(this, this.shadowRoot, atlas);
      } catch (e) {
        console.error("AtlasEditor: init failed", e);
        const panel = this.shadowRoot.querySelector(".panel");
        if (panel) {
          const pre = document.createElement("pre");
          pre.style.whiteSpace = "pre-wrap";
          pre.style.color = "#ffb4b4";
          pre.textContent = String(e && e.stack ? e.stack : e);
          panel.appendChild(pre);
        }
      }
    }
  }

  if (!customElements.get("atlas-editor")) {
    customElements.define("atlas-editor", AtlasEditor);
  }
})();
