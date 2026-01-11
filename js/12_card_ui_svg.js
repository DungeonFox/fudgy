(() => {
  const VIEWBOX = { width: 1000, height: 1400 };

  const HEADER = { top: 0, height: 130 };
  const PANELS = { top: 430, height: 880, gap: 20 };
  const FOOTER = { top: 1310, height: 90 };

  function resolveRoot(cardRoot) {
    if (typeof resolveCardRoot === "function") return resolveCardRoot(cardRoot);
    return cardRoot;
  }

  function getUiAtlas() {
    return window.cardUiAtlas || window.CARD_UI_ATLAS || window.uiAtlas || null;
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

  const headerButtonWidth = 44;
  const headerButtonHeight = 44;
  const headerButtonGap = 10;
  const headerButtonTop = 36;
  const headerButtonTotalWidth = (headerButtonWidth * 5) + (headerButtonGap * 4);
  const headerButtonStartX = 1000 - 40 - headerButtonTotalWidth;
  const headerButtonCenterY = headerButtonTop + headerButtonHeight / 2;

  const footerButtonHeights = 52;
  const footerButtonTop = FOOTER.top + (FOOTER.height - footerButtonHeights) / 2;
  const footerButtonWidths = [210, 190, 180, 220];
  const footerButtonGap = 14;
  const footerButtonTotalWidth = footerButtonWidths.reduce((sum, w) => sum + w, 0) + footerButtonGap * (footerButtonWidths.length - 1);
  const footerButtonStartX = (1000 - footerButtonTotalWidth) / 2;

  const panelSectionHeight = (PANELS.height - (PANELS.gap * 2)) / 3;
  const panelHeadingYOffset = 32;

  const GROUP_LAYOUTS = [
    {
      id: "header-title",
      name: "Header Title",
      originX: 60,
      originY: HEADER.top + 70,
      areaL: 20,
      areaR: 560,
      areaT: 40,
      areaB: 40,
      paddingPx: 8,
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
      originX: 680,
      originY: HEADER.top + 70,
      areaL: 60,
      areaR: 120,
      areaT: 30,
      areaB: 30,
      paddingPx: 6,
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
      paddingPx: 8,
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
      paddingPx: 8,
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
      paddingPx: 8,
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
      paddingPx: 8,
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
      paddingPx: 8,
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
      originX: 60,
      originY: PANELS.top + panelHeadingYOffset,
      areaL: 20,
      areaR: 920,
      areaT: 24,
      areaB: 24,
      paddingPx: 8,
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
      originX: 60,
      originY: PANELS.top + panelSectionHeight + PANELS.gap + panelHeadingYOffset,
      areaL: 20,
      areaR: 920,
      areaT: 24,
      areaB: 24,
      paddingPx: 8,
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
      originX: 60,
      originY: PANELS.top + (panelSectionHeight * 2) + (PANELS.gap * 2) + panelHeadingYOffset,
      areaL: 20,
      areaR: 920,
      areaT: 24,
      areaB: 24,
      paddingPx: 8,
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
      originY: footerButtonTop + (footerButtonHeights / 2),
      areaL: footerButtonWidths[0] / 2,
      areaR: footerButtonWidths[0] / 2,
      areaT: footerButtonHeights / 2,
      areaB: footerButtonHeights / 2,
      paddingPx: 8,
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
      originY: footerButtonTop + (footerButtonHeights / 2),
      areaL: footerButtonWidths[1] / 2,
      areaR: footerButtonWidths[1] / 2,
      areaT: footerButtonHeights / 2,
      areaB: footerButtonHeights / 2,
      paddingPx: 8,
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
      originY: footerButtonTop + (footerButtonHeights / 2),
      areaL: footerButtonWidths[2] / 2,
      areaR: footerButtonWidths[2] / 2,
      areaT: footerButtonHeights / 2,
      areaB: footerButtonHeights / 2,
      paddingPx: 8,
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
      originY: footerButtonTop + (footerButtonHeights / 2),
      areaL: footerButtonWidths[3] / 2,
      areaR: footerButtonWidths[3] / 2,
      areaT: footerButtonHeights / 2,
      areaB: footerButtonHeights / 2,
      paddingPx: 8,
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
    if (typeof dispatchUiAction === "function"){
      const handled = dispatchUiAction(root, { role, actionKey, originalEvent });
      if (handled) return;
    }
    if (!actionKey) return;
    const target = resolveActionTarget(root, actionKey);
    if (!target) return;
    target.click();
  }

  function buildGroups(root) {
    return GROUP_LAYOUTS.map((def) => buildBaseGroup(def, def.textSource ? def.textSource(root) : ""));
  }

  function renderCardUiSvg(cardRoot) {
    const root = resolveRoot(cardRoot);
    if (!root) return;
    const layout = root.querySelector(".tcg-card__layout");
    const svg = root.querySelector('[data-role="card-ui-svg"]');
    const atlas = getUiAtlas();
    const renderer = (window.AtlasSvgRenderer && window.AtlasSvgRenderer.renderAtlasGroups) || window.renderAtlasGroups;

    if (!layout || !svg || !atlas || !atlas.glyphs || typeof renderer !== "function") {
      if (layout) layout.removeAttribute("data-ui-mode");
      if (svg) svg.innerHTML = "";
      return;
    }

    const groups = buildGroups(root);
    renderer({
      svgEl: svg,
      atlas,
      groups,
      viewBoxSize: VIEWBOX,
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
})();
