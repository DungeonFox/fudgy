(() => {
  const BASE_VIEWBOX = { width: 1000, height: 1400 };
  const BASE_HEADER = { x: 0, y: 0, width: 1000, height: 130 };
  const BASE_PANELS = { x: 0, y: 430, width: 1000, height: 880 };
  const BASE_FOOTER = { x: 0, y: 1310, width: 1000, height: 90 };
  const BASE_PANEL_GAP = 20;

  let cachedAtlas = null;
  let atlasPromise = null;

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

  function loadUiAtlasOnce() {
    if (cachedAtlas) return Promise.resolve(cachedAtlas);
    const existing = window.cardUiAtlas || window.CARD_UI_ATLAS || window.uiAtlas;
    if (existing) {
      cachedAtlas = existing;
      return Promise.resolve(existing);
    }
    if (atlasPromise) return atlasPromise;

    atlasPromise = new Promise((resolve) => {
      const script = document.getElementById("font-atlas");
      if (!script) {
        resolve(null);
        return;
      }
      const inline = (script.textContent || "").trim();
      if (inline) {
        const parsed = parseAtlasJson(inline);
        cachedAtlas = parsed;
        if (parsed) window.cardUiAtlas = parsed;
        resolve(parsed);
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
      scaleX,
      scaleY,
      header: getRegionRect(svg, "header", fallbackHeader),
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
    const layoutViewBox = layoutSvg ? layoutSvg.getAttribute("viewBox") : null;
    svg.setAttribute("viewBox", layoutViewBox || "0 0 1000 1400");
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
    const { scaleX, scaleY, header, panels, footer } = metrics;
    const headerButtonWidth = 44 * scaleX;
    const headerButtonHeight = 44 * scaleY;
    const headerButtonGap = 10 * scaleX;
    const headerButtonTotalWidth = (headerButtonWidth * 5) + (headerButtonGap * 4);
    const headerButtonStartX = header.x + header.width - (40 * scaleX) - headerButtonTotalWidth;
    const headerButtonCenterY = header.y + (header.height / 2);

    const footerButtonHeight = 52 * scaleY;
    const footerButtonGap = 14 * scaleX;
    const footerButtonWidths = [210, 190, 180, 220].map((width) => width * scaleX);
    const footerButtonTotalWidth = footerButtonWidths.reduce((sum, w) => sum + w, 0) + footerButtonGap * (footerButtonWidths.length - 1);
    const footerButtonStartX = footer.x + (footer.width - footerButtonTotalWidth) / 2;
    const footerButtonTop = footer.y + (footer.height - footerButtonHeight) / 2;

    const panelSectionHeight = (panels.height - (metrics.panelGap * 2)) / 3;
    const panelHeadingYOffset = 32 * scaleY;
    const headerTitleOriginX = header.x + 60 * scaleX;
    const headerTitleOriginY = header.y + header.height * (70 / 130);
    const headerTitleLeft = header.x + 20 * scaleX;
    const headerTitleRight = headerButtonStartX - (20 * scaleX);
    const headerTitleAreaR = Math.max(60 * scaleX, headerTitleRight - headerTitleOriginX);
    const headerTitleAreaL = Math.max(20 * scaleX, headerTitleOriginX - headerTitleLeft);

    return [
      {
        id: "header-title",
        name: "Header Title",
        originX: headerTitleOriginX,
        originY: headerTitleOriginY,
        areaL: headerTitleAreaL,
        areaR: headerTitleAreaR,
        areaT: 40 * scaleY,
        areaB: 40 * scaleY,
        paddingPx: 8 * scaleX,
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
        areaL: 60 * scaleX,
        areaR: 120 * scaleX,
        areaT: 30 * scaleY,
        areaB: 30 * scaleY,
        paddingPx: 6 * scaleX,
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
        paddingPx: 8 * scaleX,
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
        paddingPx: 8 * scaleX,
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
        paddingPx: 8 * scaleX,
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
        paddingPx: 8 * scaleX,
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
        paddingPx: 8 * scaleX,
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
        originX: panels.x + 60 * scaleX,
        originY: panels.y + panelHeadingYOffset,
        areaL: 20 * scaleX,
        areaR: 920 * scaleX,
        areaT: 24 * scaleY,
        areaB: 24 * scaleY,
        paddingPx: 8 * scaleX,
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
        originX: panels.x + 60 * scaleX,
        originY: panels.y + panelSectionHeight + metrics.panelGap + panelHeadingYOffset,
        areaL: 20 * scaleX,
        areaR: 920 * scaleX,
        areaT: 24 * scaleY,
        areaB: 24 * scaleY,
        paddingPx: 8 * scaleX,
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
        originX: panels.x + 60 * scaleX,
        originY: panels.y + (panelSectionHeight * 2) + (metrics.panelGap * 2) + panelHeadingYOffset,
        areaL: 20 * scaleX,
        areaR: 920 * scaleX,
        areaT: 24 * scaleY,
        areaB: 24 * scaleY,
        paddingPx: 8 * scaleX,
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
        paddingPx: 8 * scaleX,
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
        paddingPx: 8 * scaleX,
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
        paddingPx: 8 * scaleX,
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
        paddingPx: 8 * scaleX,
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
    const layoutRect = layout.getBoundingClientRect();
    const layoutWidth = layoutRect.width || layout.clientWidth || 0;
    const layoutHeight = layoutRect.height || layout.clientHeight || 0;
    if (!layoutWidth || !layoutHeight) return [];
    const scaleX = viewBox.width / layoutWidth;
    const scaleY = viewBox.height / layoutHeight;
    const groups = [];
    let index = 0;

    getDomTextTargets(root).forEach((el) => {
      const explicit = el.getAttribute("data-ui-text");
      const text = (explicit !== null && explicit !== "") ? explicit : (el.textContent || "").trim();
      if (!text) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = viewBox.x + (rect.left - layoutRect.left) * scaleX;
      const y = viewBox.y + (rect.top - layoutRect.top) * scaleY;
      const width = rect.width * scaleX;
      const height = rect.height * scaleY;
      const style = window.getComputedStyle(el);
      const align = normalizeAlign(style.textAlign);
      const lineHeightPx = parseLineHeightPx(style, rect.height);
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
