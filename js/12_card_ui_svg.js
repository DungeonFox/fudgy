(() => {
  const BASE_VIEWBOX = { width: 1000, height: 1400 };
  const BASE_HEADER = { x: 0, y: 0, width: 1000, height: 130 };
  const BASE_SECTION_GAP = { x: 0, y: 130, width: 1000, height: 20 };
  const BASE_IMAGE = { x: 0, y: 150, width: 1000, height: 280 };
  const BASE_PANELS = { x: 0, y: 430, width: 1000, height: 880 };
  const BASE_FOOTER = { x: 0, y: 1310, width: 1000, height: 90 };
  const BASE_PANEL_GAP = 20;

  let cachedAtlas = null;
  let atlasPromise = null;
  const validatedAtlases = new WeakSet();
  const UI_FALLBACK_KEY = "U003F";
  const UI_SPACE_KEY = "U0020";
  let atlasLogged = false;

  function resolveRoot(cardRoot) {
    if (typeof resolveCardRoot === "function") return resolveCardRoot(cardRoot);
    return cardRoot;
  }

  function parseAtlasJson(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn("[card-ui-svg] Failed to parse font atlas JSON.", err);
      return null;
    }
  }

  function getAtlasFormat(atlas) {
    if (!atlas) return null;
    if (atlas.format) return atlas.format;
    if (atlas.meta && atlas.meta.format) return atlas.meta.format;
    return null;
  }

  function atlasSignature(atlas) {
    if (!atlas) return null;
    return JSON.stringify({
      format: getAtlasFormat(atlas),
      font: atlas.font || null,
      glyphs: atlas.glyphs || null
    });
  }

  function logAtlasOnce(atlas) {
    if (!atlas || atlasLogged) return;
    atlasLogged = true;
    if (!atlas.format && atlas.meta && atlas.meta.format) {
      atlas.format = atlas.meta.format;
    }
    const glyphCount = atlas.glyphs ? Object.keys(atlas.glyphs).length : 0;
    const glyphPath = atlas.glyphs && atlas.glyphs.U0041 && atlas.glyphs.U0041.svg
      ? atlas.glyphs.U0041.svg.pathD
      : undefined;
    console.log("[card-ui-svg] Atlas loaded:", atlas.format, glyphCount, glyphPath);
  }

  function loadUiAtlasOnce() {
    if (cachedAtlas) return Promise.resolve(cachedAtlas);
    if (atlasPromise) return atlasPromise;

    atlasPromise = new Promise((resolve) => {
      const existing = window.cardUiAtlas || window.CARD_UI_ATLAS || window.uiAtlas;
      const script = document.getElementById("font-atlas");
      if (!script) {
        if (existing) {
          cachedAtlas = existing;
          logAtlasOnce(existing);
          resolve(existing);
          return;
        }
        resolve(null);
        return;
      }
      const inline = (script.textContent || "").trim();
      if (inline) {
        const parsed = parseAtlasJson(inline);
        if (parsed && existing) {
          if (atlasSignature(existing) !== atlasSignature(parsed)) {
            console.warn("[card-ui-svg] Runtime atlas differs from inline #font-atlas JSON; replacing with provided atlas.");
            cachedAtlas = parsed;
            window.cardUiAtlas = parsed;
            logAtlasOnce(parsed);
            resolve(parsed);
            return;
          }
          cachedAtlas = existing;
          logAtlasOnce(existing);
          resolve(existing);
          return;
        }
        if (parsed) {
          cachedAtlas = parsed;
          window.cardUiAtlas = parsed;
          logAtlasOnce(parsed);
          resolve(parsed);
          return;
        }
        if (existing) {
          cachedAtlas = existing;
          logAtlasOnce(existing);
          resolve(existing);
          return;
        }
        resolve(null);
        return;
      }
      if (existing) {
        cachedAtlas = existing;
        logAtlasOnce(existing);
        resolve(existing);
        return;
      }
      resolve(null);
    });

    return atlasPromise;
  }

  function getUiAtlas() {
    return cachedAtlas || window.cardUiAtlas || window.CARD_UI_ATLAS || window.uiAtlas || null;
  }

  function textFromSelector(root, selector) {
    if (!root) return "";
    const el = root.querySelector(selector);
    return el ? (el.textContent || "").trim() : "";
  }

  function textFromHeading(root, role) {
    if (!root) return "";
    const heading = root.querySelector(`[data-role="${role}"]`);
    if (!heading) return "";
    const label = heading.querySelector("span");
    return label ? (label.textContent || "").trim() : (heading.textContent || "").trim();
  }

  function textFromDeterministicLabel(root) {
    if (!root) return "";
    const input = root.querySelector('[data-role="deterministic-ids"]');
    const label = input ? input.closest("label") : null;
    return label ? (label.textContent || "").trim() : "";
  }

  function normalizeUiText(s) {
    if (!s) return "";
    s = s.replaceAll("\r\n", "\n");
    s = s.replaceAll("\r", "\n");
    s = s.split("“").join('"').split("”").join('"');
    s = s.split("‘").join("'").split("’").join("'");
    s = s.split("–").join("-").split("—").join("-");
    s = s.split("…").join("...");
    s = s.split("•").join("*").split("·").join("*");
    s = s.split("\u00A0").join(" ");
    return s;
  }

  function keyForChar(ch) {
    const cp = ch.codePointAt(0);
    const hex = cp.toString(16).toUpperCase().padStart(4, "0");
    return "U" + hex;
  }

  function validateAtlasForGroups(groups, atlas) {
    if (!atlas || !atlas.glyphs) return;
    if (validatedAtlases.has(atlas)) return;
    validatedAtlases.add(atlas);
    const glyphs = atlas.glyphs;
    const missing = new Set();

    for (const group of (groups || [])) {
      const text = normalizeUiText(group.text || "");
      for (const ch of text) {
        let normalized = ch;
        if (normalized === "\t" || normalized === "\n") normalized = " ";
        const key = keyForChar(normalized);
        const glyph = glyphs[key];
        if (!(glyph && glyph.svg && glyph.svg.pathD)) missing.add(key);
      }
    }

    missing.add(UI_SPACE_KEY);
    if (glyphs[UI_FALLBACK_KEY] && !(glyphs[UI_FALLBACK_KEY].svg && glyphs[UI_FALLBACK_KEY].svg.pathD)) {
      missing.add(UI_FALLBACK_KEY);
    }

    if (missing.size) {
      const list = Array.from(missing).sort().join(", ");
      console.warn(`[card-ui-svg] Atlas missing svg.pathD for UI glyphs: ${list}.`);
    }
  }

  function getViewBox(svg) {
    if (!svg) return null;
    if (typeof getViewBoxDimensions === "function") {
      const vb = getViewBoxDimensions(svg);
      if (vb && vb.width && vb.height) {
        return { x: vb.x || 0, y: vb.y || 0, width: vb.width, height: vb.height };
      }
    }
    const raw = svg.getAttribute("viewBox") || "";
    const parts = raw.trim().split(/[,\s]+/).map(Number);
    if (parts.length >= 4 && parts.every((value) => Number.isFinite(value))) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
    return null;
  }

  function getRegionRect(svg, name, fallback) {
    if (!svg) return fallback;
    const region = svg.querySelector(`[data-region="${name}"]`);
    if (!region) return fallback;
    if (region.tagName && region.tagName.toLowerCase() === "rect") {
      const x = Number(region.getAttribute("x"));
      const y = Number(region.getAttribute("y"));
      const width = Number(region.getAttribute("width"));
      const height = Number(region.getAttribute("height"));
      if ([x, y, width, height].every((value) => Number.isFinite(value))) {
        return { x, y, width, height };
      }
    }
    if (typeof region.getBBox === "function") {
      const box = region.getBBox();
      if ([box.x, box.y, box.width, box.height].every((value) => Number.isFinite(value))) {
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }
    }
    return fallback;
  }

  function getLayoutMetrics(root) {
    const svg = root ? root.querySelector(".card-layout") : null;
    const viewBox = getViewBox(svg) || { ...BASE_VIEWBOX, x: 0, y: 0 };
    const scaleX = viewBox.width / BASE_VIEWBOX.width;
    const scaleY = viewBox.height / BASE_VIEWBOX.height;
    const fallbackHeader = {
      x: viewBox.x || 0,
      y: viewBox.y || 0,
      width: viewBox.width,
      height: BASE_HEADER.height * scaleY
    };
    const fallbackSectionGap = {
      x: viewBox.x || 0,
      y: (viewBox.y || 0) + BASE_SECTION_GAP.y * scaleY,
      width: viewBox.width,
      height: BASE_SECTION_GAP.height * scaleY
    };
    const fallbackImage = {
      x: viewBox.x || 0,
      y: (viewBox.y || 0) + BASE_IMAGE.y * scaleY,
      width: viewBox.width,
      height: BASE_IMAGE.height * scaleY
    };
    const fallbackPanels = {
      x: viewBox.x || 0,
      y: (viewBox.y || 0) + BASE_PANELS.y * scaleY,
      width: viewBox.width,
      height: BASE_PANELS.height * scaleY
    };
    const fallbackFooter = {
      x: viewBox.x || 0,
      y: (viewBox.y || 0) + BASE_FOOTER.y * scaleY,
      width: viewBox.width,
      height: BASE_FOOTER.height * scaleY
    };
    return {
      viewBox,
      header: getRegionRect(svg, "header", fallbackHeader),
      sectionGap: getRegionRect(svg, "section-gap", fallbackSectionGap),
      image: getRegionRect(svg, "image", fallbackImage),
      panels: getRegionRect(svg, "panels", fallbackPanels),
      footer: getRegionRect(svg, "footer", fallbackFooter),
      panelGap: BASE_PANEL_GAP * scaleY
    };
  }

  function ensureUiSvgLayer(root) {
    if (!root) return null;
    const layout = root.querySelector(".tcg-card__layout");
    if (!layout) return null;
    const layoutSvg = layout.querySelector(".card-layout");
    let svg = layout.querySelector('[data-role="card-ui-svg"]') || root.querySelector('[data-role="card-ui-svg"]');
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "card-ui-svg");
      svg.setAttribute("data-role", "card-ui-svg");
    }
    if (svg.parentElement !== layout) {
      layout.appendChild(svg);
    }
    svg.setAttribute("viewBox", "0 0 1000 1400");
    const preserve = layoutSvg ? layoutSvg.getAttribute("preserveAspectRatio") : null;
    if (preserve) {
      svg.setAttribute("preserveAspectRatio", preserve);
    } else {
      svg.removeAttribute("preserveAspectRatio");
    }
    return svg;
  }

  function buildBaseGroup(def, text) {
    return {
      id: def.id,
      name: def.name,
      originX: def.originX,
      originY: def.originY,
      areaL: def.areaL,
      areaR: def.areaR,
      areaT: def.areaT,
      areaB: def.areaB,
      paddingPx: def.paddingPx,
      lineGapPx: def.lineGapPx,
      trackingUnits: def.trackingUnits,
      allowWrap: def.allowWrap,
      maxLines: def.maxLines,
      breakLongWords: def.breakLongWords,
      lineBottomOffsetsPx: def.lineBottomOffsetsPx,
      align: def.align,
      hOffsetPx: def.hOffsetPx,
      pixelSnap: def.pixelSnap,
      showGuides: def.showGuides,
      opacity: def.opacity,
      uiRole: def.uiRole,
      dataRole: def.dataRole,
      contentAsButton: def.contentAsButton,
      actionKey: def.actionKey,
      text: text
    };
  }

  function buildGroupLayouts(root) {
    const metrics = getLayoutMetrics(root);
    const { header, panels, footer } = metrics;
    const headerScaleX = header.width / BASE_HEADER.width;
    const headerScaleY = header.height / BASE_HEADER.height;
    const panelsScaleX = panels.width / BASE_PANELS.width;
    const panelsScaleY = panels.height / BASE_PANELS.height;
    const footerScaleX = footer.width / BASE_FOOTER.width;
    const footerScaleY = footer.height / BASE_FOOTER.height;
    const headerButtonWidth = 44 * headerScaleX;
    const headerButtonHeight = 44 * headerScaleY;
    const headerButtonGap = 10 * headerScaleX;
    const headerButtonTotalWidth = (headerButtonWidth * 5) + (headerButtonGap * 4);
    const headerButtonStartX = header.x + header.width - (40 * headerScaleX) - headerButtonTotalWidth;
    const headerButtonCenterY = header.y + (header.height / 2);

    const footerButtonHeight = 52 * footerScaleY;
    const footerButtonGap = 14 * footerScaleX;
    const footerButtonWidths = [210, 190, 180, 220].map((width) => width * footerScaleX);
    const footerButtonTotalWidth = footerButtonWidths.reduce((sum, w) => sum + w, 0) + footerButtonGap * (footerButtonWidths.length - 1);
    const footerButtonStartX = footer.x + (footer.width - footerButtonTotalWidth) / 2;
    const footerButtonTop = footer.y + (footer.height - footerButtonHeight) / 2;

    const panelGap = BASE_PANEL_GAP * panelsScaleY;
    const panelSectionHeight = (panels.height - (panelGap * 2)) / 3;
    const panelHeadingYOffset = 32 * panelsScaleY;
    const headerTitleOriginX = header.x + 60 * headerScaleX;
    const headerTitleOriginY = header.y + header.height * (70 / BASE_HEADER.height);
    const headerTitleLeft = header.x + 20 * headerScaleX;
    const headerTitleRight = headerButtonStartX - (20 * headerScaleX);
    const headerTitleAreaR = Math.max(60 * headerScaleX, headerTitleRight - headerTitleOriginX);
    const headerTitleAreaL = Math.max(20 * headerScaleX, headerTitleOriginX - headerTitleLeft);

    return [
      {
        id: "header-title",
        name: "Header Title",
        originX: headerTitleOriginX,
        originY: headerTitleOriginY,
        areaL: headerTitleAreaL,
        areaR: headerTitleAreaR,
        areaT: 40 * headerScaleY,
        areaB: 40 * headerScaleY,
        paddingPx: 8 * headerScaleX,
        lineGapPx: 0,
        trackingUnits: 18,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "left",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 1,
        uiRole: "text",
        contentAsButton: false,
        textSource: (root) => textFromSelector(root, '[data-role="card-title"]')
      },
      {
        id: "header-status",
        name: "Header Status",
        originX: header.x + header.width * 0.68,
        originY: headerTitleOriginY,
        areaL: 60 * headerScaleX,
        areaR: 120 * headerScaleX,
        areaT: 30 * headerScaleY,
        areaB: 30 * headerScaleY,
        paddingPx: 6 * headerScaleX,
        lineGapPx: 0,
        trackingUnits: 16,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "center",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 0.9,
        uiRole: "text",
        contentAsButton: false,
        textSource: (root) => textFromSelector(root, '[data-role="play-mini"]')
      },
      {
        id: "header-play",
        name: "Play",
        uiRole: "button",
        actionKey: "play",
        dataRole: "btn-play",
        originX: headerButtonStartX + (headerButtonWidth / 2),
        originY: headerButtonCenterY,
        areaL: headerButtonWidth / 2,
        areaR: headerButtonWidth / 2,
        areaT: headerButtonHeight / 2,
        areaB: headerButtonHeight / 2,
        paddingPx: 8 * headerScaleX,
        lineGapPx: 0,
        trackingUnits: 12,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "center",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 1,
        contentAsButton: false,
        textSource: (root) => textFromSelector(root, '[data-role="btn-play"]')
      },
      {
        id: "header-step",
        name: "Step",
        uiRole: "button",
        actionKey: "step",
        dataRole: "btn-step",
        originX: headerButtonStartX + (headerButtonWidth / 2) + (headerButtonWidth + headerButtonGap),
        originY: headerButtonCenterY,
        areaL: headerButtonWidth / 2,
        areaR: headerButtonWidth / 2,
        areaT: headerButtonHeight / 2,
        areaB: headerButtonHeight / 2,
        paddingPx: 8 * headerScaleX,
        lineGapPx: 0,
        trackingUnits: 12,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "center",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 1,
        contentAsButton: false,
        textSource: (root) => textFromSelector(root, '[data-role="btn-step"]')
      },
      {
        id: "header-reset",
        name: "Reset",
        uiRole: "button",
        actionKey: "reset",
        dataRole: "btn-reset",
        originX: headerButtonStartX + (headerButtonWidth / 2) + (headerButtonWidth + headerButtonGap) * 2,
        originY: headerButtonCenterY,
        areaL: headerButtonWidth / 2,
        areaR: headerButtonWidth / 2,
        areaT: headerButtonHeight / 2,
        areaB: headerButtonHeight / 2,
        paddingPx: 8 * headerScaleX,
        lineGapPx: 0,
        trackingUnits: 12,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "center",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 1,
        contentAsButton: false,
        textSource: (root) => textFromSelector(root, '[data-role="btn-reset"]')
      },
      {
        id: "header-registry",
        name: "Toggle Registry",
        uiRole: "button",
        actionKey: "toggle-registry",
        originX: headerButtonStartX + (headerButtonWidth / 2) + (headerButtonWidth + headerButtonGap) * 3,
        originY: headerButtonCenterY,
        areaL: headerButtonWidth / 2,
        areaR: headerButtonWidth / 2,
        areaT: headerButtonHeight / 2,
        areaB: headerButtonHeight / 2,
        paddingPx: 8 * headerScaleX,
        lineGapPx: 0,
        trackingUnits: 12,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "center",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 1,
        contentAsButton: false,
        textSource: (root) => textFromSelector(root, '[data-panel-toggle="registry"]')
      },
      {
        id: "header-log",
        name: "Toggle Log",
        uiRole: "button",
        actionKey: "toggle-log",
        originX: headerButtonStartX + (headerButtonWidth / 2) + (headerButtonWidth + headerButtonGap) * 4,
        originY: headerButtonCenterY,
        areaL: headerButtonWidth / 2,
        areaR: headerButtonWidth / 2,
        areaT: headerButtonHeight / 2,
        areaB: headerButtonHeight / 2,
        paddingPx: 8 * headerScaleX,
        lineGapPx: 0,
        trackingUnits: 12,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "center",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 1,
        contentAsButton: false,
        textSource: (root) => textFromSelector(root, '[data-panel-toggle="log"]')
      },
      {
        id: "panel-template-heading",
        name: "Template Heading",
        originX: panels.x + 60 * panelsScaleX,
        originY: panels.y + panelHeadingYOffset,
        areaL: 20 * panelsScaleX,
        areaR: 920 * panelsScaleX,
        areaT: 24 * panelsScaleY,
        areaB: 24 * panelsScaleY,
        paddingPx: 8 * panelsScaleX,
        lineGapPx: 0,
        trackingUnits: 14,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "left",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 0.9,
        uiRole: "text",
        contentAsButton: false,
        textSource: (root) => textFromHeading(root, "panel-heading-template")
      },
      {
        id: "panel-recipe-heading",
        name: "Recipe Heading",
        originX: panels.x + 60 * panelsScaleX,
        originY: panels.y + panelSectionHeight + panelGap + panelHeadingYOffset,
        areaL: 20 * panelsScaleX,
        areaR: 920 * panelsScaleX,
        areaT: 24 * panelsScaleY,
        areaB: 24 * panelsScaleY,
        paddingPx: 8 * panelsScaleX,
        lineGapPx: 0,
        trackingUnits: 14,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "left",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 0.9,
        uiRole: "text",
        contentAsButton: false,
        textSource: (root) => textFromHeading(root, "panel-heading-recipe")
      },
      {
        id: "panel-task-heading",
        name: "Task Heading",
        originX: panels.x + 60 * panelsScaleX,
        originY: panels.y + (panelSectionHeight * 2) + (panelGap * 2) + panelHeadingYOffset,
        areaL: 20 * panelsScaleX,
        areaR: 920 * panelsScaleX,
        areaT: 24 * panelsScaleY,
        areaB: 24 * panelsScaleY,
        paddingPx: 8 * panelsScaleX,
        lineGapPx: 0,
        trackingUnits: 14,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "left",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 0.9,
        uiRole: "text",
        contentAsButton: false,
        textSource: (root) => textFromHeading(root, "panel-heading-task")
      },
      {
        id: "footer-deterministic",
        name: "Deterministic IDs",
        uiRole: "button",
        actionKey: "deterministic-ids",
        dataRole: "deterministic-ids",
        originX: footerButtonStartX + (footerButtonWidths[0] / 2),
        originY: footerButtonTop + (footerButtonHeight / 2),
        areaL: footerButtonWidths[0] / 2,
        areaR: footerButtonWidths[0] / 2,
        areaT: footerButtonHeight / 2,
        areaB: footerButtonHeight / 2,
        paddingPx: 8 * footerScaleX,
        lineGapPx: 0,
        trackingUnits: 12,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "center",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 1,
        contentAsButton: false,
        textSource: (root) => textFromDeterministicLabel(root)
      },
      {
        id: "footer-rehash",
        name: "Recompute IDs",
        uiRole: "button",
        actionKey: "rehash",
        dataRole: "btn-rehash",
        originX: footerButtonStartX + footerButtonWidths[0] + footerButtonGap + (footerButtonWidths[1] / 2),
        originY: footerButtonTop + (footerButtonHeight / 2),
        areaL: footerButtonWidths[1] / 2,
        areaR: footerButtonWidths[1] / 2,
        areaT: footerButtonHeight / 2,
        areaB: footerButtonHeight / 2,
        paddingPx: 8 * footerScaleX,
        lineGapPx: 0,
        trackingUnits: 12,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "center",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 1,
        contentAsButton: false,
        textSource: (root) => textFromSelector(root, '[data-role="btn-rehash"]')
      },
      {
        id: "footer-popout",
        name: "Pop-out Viewer",
        uiRole: "button",
        actionKey: "popout",
        dataRole: "btn-popout",
        originX: footerButtonStartX + footerButtonWidths[0] + footerButtonWidths[1] + (footerButtonGap * 2) + (footerButtonWidths[2] / 2),
        originY: footerButtonTop + (footerButtonHeight / 2),
        areaL: footerButtonWidths[2] / 2,
        areaR: footerButtonWidths[2] / 2,
        areaT: footerButtonHeight / 2,
        areaB: footerButtonHeight / 2,
        paddingPx: 8 * footerScaleX,
        lineGapPx: 0,
        trackingUnits: 12,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "center",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 1,
        contentAsButton: false,
        textSource: (root) => textFromSelector(root, '[data-role="btn-popout"]')
      },
      {
        id: "footer-export",
        name: "Export Atlas",
        uiRole: "button",
        actionKey: "export-atlas",
        dataRole: "btn-export-atlas",
        originX: footerButtonStartX + footerButtonWidths[0] + footerButtonWidths[1] + footerButtonWidths[2] + (footerButtonGap * 3) + (footerButtonWidths[3] / 2),
        originY: footerButtonTop + (footerButtonHeight / 2),
        areaL: footerButtonWidths[3] / 2,
        areaR: footerButtonWidths[3] / 2,
        areaT: footerButtonHeight / 2,
        areaB: footerButtonHeight / 2,
        paddingPx: 8 * footerScaleX,
        lineGapPx: 0,
        trackingUnits: 12,
        allowWrap: false,
        maxLines: 1,
        breakLongWords: false,
        lineBottomOffsetsPx: [0],
        align: "center",
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 1,
        contentAsButton: false,
        textSource: (root) => textFromSelector(root, '[data-role="btn-export-atlas"]')
      }
    ];
  }

  function resolveActionTarget(root, actionKey) {
    if (!root) return null;
    switch (actionKey) {
      case "play":
        return root.querySelector('[data-role="btn-play"]');
      case "step":
        return root.querySelector('[data-role="btn-step"]');
      case "reset":
        return root.querySelector('[data-role="btn-reset"]');
      case "toggle-registry":
        return root.querySelector('[data-panel-toggle="registry"]');
      case "toggle-log":
        return root.querySelector('[data-panel-toggle="log"]');
      case "deterministic-ids":
        return root.querySelector('[data-role="deterministic-ids"]');
      case "rehash":
        return root.querySelector('[data-role="btn-rehash"]');
      case "popout":
        return root.querySelector('[data-role="btn-popout"]');
      case "export-atlas":
        return root.querySelector('[data-role="btn-export-atlas"]');
      default:
        return null;
    }
  }

  function handleGroupAction({ group, originalEvent }, root) {
    if (!group) return;
    const actionKey = group.actionKey || "";
    const role = group.dataRole || "";
    let handled = false;
    if (typeof dispatchUiAction === "function"){
      handled = dispatchUiAction(root, { role, actionKey, originalEvent });
      if (handled){
        if (originalEvent) originalEvent.__uiActionHandled = true;
        return;
      }
    }
    if (!actionKey) return;
    const target = resolveActionTarget(root, actionKey);
    if (!target) return;
    target.click();
    if (originalEvent) originalEvent.__uiActionHandled = true;
  }

  function buildGroups(root) {
    return buildGroupLayouts(root).map((def) => buildBaseGroup(def, def.textSource ? def.textSource(root) : ""));
  }

  function getDomTextTargets(root) {
    if (!root) return [];
    const scope = root.querySelector(".tcg-card") || root;
    return Array.from(scope.querySelectorAll("[data-ui-text]")).filter((el) => !el.closest(".card-ui-svg"));
  }

  function normalizeAlign(value) {
    const align = (value || "").toLowerCase();
    if (align === "center" || align === "right") return align;
    if (align === "end") return "right";
    return "left";
  }

  function parseLineHeightPx(style, fallbackPx) {
    const raw = style ? parseFloat(style.lineHeight) : NaN;
    if (Number.isFinite(raw)) return raw;
    const fontSize = style ? parseFloat(style.fontSize) : NaN;
    if (Number.isFinite(fontSize)) return fontSize * 1.2;
    return fallbackPx;
  }

  function buildDomTextGroups(root) {
    const layout = root ? root.querySelector(".tcg-card__layout") : null;
    const layoutSvg = root ? root.querySelector(".card-layout") : null;
    const viewBox = getViewBox(layoutSvg);
    if (!layout || !viewBox) return [];
    const groups = [];
    let index = 0;

    const metrics = getLayoutMetrics(root);
    const regionFallback = {
      x: viewBox.x || 0,
      y: viewBox.y || 0,
      width: viewBox.width,
      height: viewBox.height
    };

    function findRegionContainer(el) {
      if (!el) return null;
      return el.closest("[data-ui-region]");
    }

    function getRegionForElement(el) {
      const container = findRegionContainer(el);
      const regionName = container ? container.getAttribute("data-ui-region") : null;
      if (regionName && metrics[regionName]) {
        return { name: regionName, rect: metrics[regionName], container };
      }
      return { name: "safe", rect: regionFallback, container: layout };
    }

    function getOffsetWithin(el, container) {
      let x = 0;
      let y = 0;
      let node = el;
      while (node && node !== container) {
        x += node.offsetLeft || 0;
        y += node.offsetTop || 0;
        node = node.offsetParent;
      }
      return { x, y };
    }

    getDomTextTargets(root).forEach((el) => {
      const explicit = el.getAttribute("data-ui-text");
      const text = (explicit !== null && explicit !== "") ? explicit : (el.textContent || "").trim();
      if (!text) return;
      const { rect: region, container } = getRegionForElement(el);
      if (!container) return;
      const containerWidth = container.clientWidth || 0;
      const containerHeight = container.clientHeight || 0;
      if (!containerWidth || !containerHeight) return;
      const offset = getOffsetWithin(el, container);
      const elWidth = el.offsetWidth || 0;
      const elHeight = el.offsetHeight || 0;
      if (!elWidth || !elHeight) return;
      const x = region.x + (offset.x / containerWidth) * region.width;
      const y = region.y + (offset.y / containerHeight) * region.height;
      const width = (elWidth / containerWidth) * region.width;
      const height = (elHeight / containerHeight) * region.height;
      const style = window.getComputedStyle(el);
      const align = normalizeAlign(style.textAlign);
      const lineHeightPx = parseLineHeightPx(style, elHeight);
      const scaleY = region.height / containerHeight;
      const lineHeight = lineHeightPx * scaleY;
      const maxLines = Math.max(1, Math.floor(height / Math.max(1, lineHeight)));
      const allowWrap = style.whiteSpace !== "nowrap" && maxLines > 1;
      const paddingPx = Math.max(1, Math.min(width, height) * 0.08);
      const lineBottomOffsetsPx = Array.from({ length: maxLines }, (_, i) => (lineHeight * (i + 1)) - (height / 2));

      groups.push({
        id: `dom-text-${index}`,
        name: el.getAttribute("data-ui-name") || `DOM Text ${index + 1}`,
        originX: x + (width / 2),
        originY: y + (height / 2),
        areaL: width / 2,
        areaR: width / 2,
        areaT: height / 2,
        areaB: height / 2,
        paddingPx,
        lineGapPx: 0,
        trackingUnits: 12,
        allowWrap,
        maxLines,
        breakLongWords: false,
        lineBottomOffsetsPx,
        align,
        hOffsetPx: 0,
        pixelSnap: true,
        showGuides: false,
        opacity: 1,
        uiRole: "text",
        contentAsButton: false,
        text
      });
      index += 1;
    });

    return groups;
  }

  function renderCardUiSvg(cardRoot) {
    const root = resolveRoot(cardRoot);
    if (!root) return;
    const layout = root.querySelector(".tcg-card__layout");
    const svg = ensureUiSvgLayer(root);
    const atlas = getUiAtlas();
    const renderer = (window.AtlasSvgRenderer && window.AtlasSvgRenderer.renderAtlasGroups) || window.renderAtlasGroups;

    if (!layout || !svg || !atlas || !atlas.glyphs || typeof renderer !== "function") {
      if (layout) layout.removeAttribute("data-ui-mode");
      if (svg) svg.innerHTML = "";
      return;
    }

    const groups = buildGroups(root).concat(buildDomTextGroups(root));
    validateAtlasForGroups(groups, atlas);
    renderer({
      svgEl: svg,
      atlas,
      groups,
      viewBoxSize: getLayoutMetrics(root).viewBox,
      onGroupAction: (payload) => handleGroupAction(payload, root)
    });

    layout.setAttribute("data-ui-mode", "svg");
  }

  window.initCardUiSvg = function initCardUiSvg(cardRoot) {
    renderCardUiSvg(cardRoot);
  };

  window.updateCardUiSvg = function updateCardUiSvg(cardRoot) {
    renderCardUiSvg(cardRoot);
  };

  loadUiAtlasOnce().then((atlas) => {
    if (!atlas) return;
    const shells = document.querySelectorAll(".card-shell");
    shells.forEach((root) => renderCardUiSvg(root));
  });
})();
