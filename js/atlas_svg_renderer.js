/* Atlas SVG Renderer (reusable, no dependencies)
   Exposes: renderAtlasGroups({ svgEl, atlas, groups, viewBoxSize, onGroupAction, globalGuides, selectedGroupId })
*/
(function() {
  const NS = "http://www.w3.org/2000/svg";

  function svgEl(name) {
    return document.createElementNS(NS, name);
  }

  function snapToDPR(v) {
    const dpr = window.devicePixelRatio || 1;
    return Math.round(v * dpr) / dpr;
  }

  function normalizeText(s) {
    // Avoid regex literals entirely (to keep file:// parsing bulletproof).
    // Normalize line endings
    s = s.replaceAll("\r\n", "\n");
    s = s.replaceAll("\r", "\n");
    // Curly quotes
    s = s.split("“").join('"').split("”").join('"');
    s = s.split("‘").join("'").split("’").join("'");
    // En / em dash
    s = s.split("–").join("-").split("—").join("-");
    // Ellipsis
    s = s.split("…").join("...");
    // Bullet / middot
    s = s.split("•").join("*").split("·").join("*");
    // Non-breaking space
    s = s.split("\u00A0").join(" ");
    return s;
  }

  function keyForChar(ch) {
    const cp = ch.codePointAt(0);
    const hex = cp.toString(16).toUpperCase().padStart(4, "0");
    return "U" + hex;
  }

  function hasRenderableGlyph(key, glyphs) {
    const g = glyphs[key];
    return !!(g && g.svg && g.svg.pathD);
  }

  function glyphForChar(ch, glyphs, fallbackKey, spaceKey) {
    if (ch === "\t") ch = " ";
    const key = keyForChar(ch);
    if (hasRenderableGlyph(key, glyphs)) return key;
    if (hasRenderableGlyph(fallbackKey, glyphs)) return fallbackKey;
    return glyphs[spaceKey] ? spaceKey : key;
  }

  function isSpaceGlyphKey(key, spaceKey) {
    return key === spaceKey;
  }

  // Tokenization for word wrap: word / space / newline
  function tokenize(text, glyphs, fallbackKey, spaceKey) {
    text = normalizeText(text);
    const tokens = [];
    let buf = [];
    let mode = null; // "word" | "space"

    function flush() {
      if (!buf.length) return;
      tokens.push({ type: mode, glyphKeys: buf });
      buf = [];
    }

    for (const ch of text) {
      if (ch === "\n") {
        flush();
        tokens.push({ type: "newline" });
        mode = null;
        continue;
      }
      if (ch === " " || ch === "\t") {
        if (mode !== "space") flush();
        mode = "space";
        // Keep multiple spaces as multiple space glyphs (so width is explicit)
        buf.push(spaceKey);
        continue;
      }
      if (mode !== "word") flush();
      mode = "word";
      buf.push(glyphForChar(ch, glyphs, fallbackKey, spaceKey));
    }
    flush();
    return tokens;
  }

  function resolveGlyphEntry(key, glyphs, fallbackKey) {
    if (hasRenderableGlyph(key, glyphs)) return { key, glyph: glyphs[key] };
    if (hasRenderableGlyph(fallbackKey, glyphs)) return { key: fallbackKey, glyph: glyphs[fallbackKey] };
    if (glyphs[key]) return { key, glyph: glyphs[key] };
    return null;
  }

  function glyphWidthUnits(key, glyphs, fallbackKey) {
    const entry = resolveGlyphEntry(key, glyphs, fallbackKey);
    if (!entry || !entry.glyph.edges) return 0;
    return (entry.glyph.edges.L + entry.glyph.edges.R);
  }

  function glyphHeightUnits(key, glyphs, fallbackKey) {
    const entry = resolveGlyphEntry(key, glyphs, fallbackKey);
    if (!entry || !entry.glyph.edges) return 0;
    return (entry.glyph.edges.T + entry.glyph.edges.B);
  }

  // Measure a flat glyph list in units (tracking applied between glyphs, not after last)
  function measureGlyphRunUnits(glyphKeys, trackingUnits, glyphs, fallbackKey, spaceKey) {
    let w = 0;
    let h = 0;
    let nonSpaceH = 0;
    for (let i = 0; i < glyphKeys.length; i++) {
      const key = glyphKeys[i];
      w += glyphWidthUnits(key, glyphs, fallbackKey);
      if (i !== glyphKeys.length - 1) w += trackingUnits;
      if (!isSpaceGlyphKey(key, spaceKey)) {
        nonSpaceH = Math.max(nonSpaceH, glyphHeightUnits(key, glyphs, fallbackKey));
      }
      h = Math.max(h, glyphHeightUnits(key, glyphs, fallbackKey));
    }
    // For line height, use non-space height when possible (keeps multiple spaces from inflating line height)
    return { width: w, height: (nonSpaceH || h) };
  }

  // Split a too-wide word token into smaller word tokens (character fallback)
  function splitWordToken(wordToken, maxWidthUnits, trackingUnits, glyphs, fallbackKey, spaceKey) {
    const parts = [];
    const keys = wordToken.glyphKeys;
    let start = 0;

    while (start < keys.length) {
      let end = start;
      let run = [];
      let best = start;

      while (end < keys.length) {
        run.push(keys[end]);
        const m = measureGlyphRunUnits(run, trackingUnits, glyphs, fallbackKey, spaceKey);
        if (m.width <= maxWidthUnits) {
          best = end + 1;
          end++;
          continue;
        }
        break;
      }

      if (best === start) {
        // single glyph doesn't fit; emit it anyway, the scale fitter will shrink
        parts.push({ type: "word", glyphKeys: [keys[start]] });
        start += 1;
      } else {
        parts.push({ type: "word", glyphKeys: keys.slice(start, best) });
        start = best;
      }
    }
    return parts;
  }

  // Wrap tokens into lines (each line becomes a flat glyph list)
  function wrapToLines(tokens, maxWidthUnits, trackingUnits, maxLines, breakLongWords, glyphs, fallbackKey, spaceKey) {
    const lines = [];
    let lineKeys = [];

    function commitLine() {
      // Trim leading spaces (shouldn't happen often, but safe)
      while (lineKeys.length && isSpaceGlyphKey(lineKeys[0], spaceKey)) lineKeys.shift();
      // Trim trailing spaces
      while (lineKeys.length && isSpaceGlyphKey(lineKeys[lineKeys.length - 1], spaceKey)) lineKeys.pop();
      lines.push(lineKeys);
      lineKeys = [];
    }

    function lineWidthIfAppended(keysToAppend) {
      const combined = lineKeys.concat(keysToAppend);
      return measureGlyphRunUnits(combined, trackingUnits, glyphs, fallbackKey, spaceKey).width;
    }

    let ti = 0;
    while (ti < tokens.length) {
      const t = tokens[ti];

      if (t.type === "newline") {
        commitLine();
        if (lines.length >= maxLines) return { ok: false, lines: [] };
        ti++;
        continue;
      }

      const tokenKeys = t.glyphKeys || [];

      // Skip leading spaces on a fresh line
      if (!lineKeys.length && tokenKeys.length && isSpaceGlyphKey(tokenKeys[0], spaceKey)) {
        // But if it's multiple spaces, still skip all of them at line start
        ti++;
        continue;
      }

      // If token is a word too wide for an empty line, split (optional)
      if (t.type === "word" && !lineKeys.length) {
        const m = measureGlyphRunUnits(tokenKeys, trackingUnits, glyphs, fallbackKey, spaceKey);
        if (m.width > maxWidthUnits) {
          if (breakLongWords) {
            const parts = splitWordToken(t, maxWidthUnits, trackingUnits, glyphs, fallbackKey, spaceKey);
            // Replace this token with its parts in the stream
            tokens.splice(ti, 1, ...parts);
            continue; // reprocess at same index
          } else {
            return { ok: false, lines: [] }; // force scale shrink
          }
        }
      }

      // Try append; if overflow and line not empty, wrap
      const wouldOverflow = lineKeys.length && (lineWidthIfAppended(tokenKeys) > maxWidthUnits);

      if (wouldOverflow) {
        commitLine();
        if (lines.length >= maxLines) return { ok: false, lines: [] };
        // After wrapping, drop spaces again
        if (t.type === "space") {
          ti++;
          continue;
        }
        continue; // retry same token on new line
      }

      // Append
      for (const k of tokenKeys) lineKeys.push(k);
      ti++;
    }

    commitLine();
    return { ok: true, lines };
  }

  // Check whether lines can be placed at fixed bottoms, inside the group area.
  function linesFitFixedBottoms(lines, bottomsPx, area, paddingPx, gapPx, scale, trackingUnits, glyphs, fallbackKey, spaceKey) {
    const usableTop = area.top + paddingPx;
    const usableBottom = area.bottom - paddingPx;

    for (let i = 0; i < lines.length; i++) {
      const lineKeys = lines[i];
      const bottom = bottomsPx[i];

      if (bottom > usableBottom) return false;
      const m = measureGlyphRunUnits(lineKeys, trackingUnits, glyphs, fallbackKey, spaceKey);
      const heightPx = m.height * scale;
      const top = bottom - heightPx;
      if (top < usableTop) return false;

      if (i > 0) {
        const prevBottom = bottomsPx[i - 1];
        if (top < prevBottom + gapPx) return false;
      }
    }
    return true;
  }

  function getAreaRect(group) {
    return {
      left: group.originX - group.areaL,
      right: group.originX + group.areaR,
      top: group.originY - group.areaT,
      bottom: group.originY + group.areaB
    };
  }

  // Compute placements (glyph instances) for a group at a given scale.
  function buildPlacementsForGroup(group, scale, glyphs, fallbackKey, spaceKey) {
    const area = getAreaRect(group);
    const padding = group.paddingPx;
    const gapPx = group.lineGapPx;
    const trackingUnits = group.trackingUnits;

    const maxLines = Math.max(1, Math.min(group.maxLines, group.lineBottomOffsetsPx.length));
    const bottomsPx = group.lineBottomOffsetsPx.slice(0, maxLines).map(off => group.originY + off);

    const Wpx = (area.right - area.left) - 2 * padding;
    const maxWidthUnits = Wpx / scale;

    const tokens = tokenize(group.text, glyphs, fallbackKey, spaceKey);
    const wrapAllowed = group.allowWrap && maxLines > 1;

    let linesRes;
    if (!wrapAllowed) {
      // no wrap: one line (all tokens flattened, newlines treated as spaces)
      const flat = [];
      for (const t of tokens) {
        if (t.type === "newline") {
          // treat newline as a space in no-wrap mode
          flat.push(spaceKey);
          continue;
        }
        if (t.glyphKeys) for (const k of t.glyphKeys) flat.push(k);
      }
      // trim leading/trailing spaces
      while (flat.length && isSpaceGlyphKey(flat[0], spaceKey)) flat.shift();
      while (flat.length && isSpaceGlyphKey(flat[flat.length - 1], spaceKey)) flat.pop();
      linesRes = { ok: true, lines: [flat] };
    } else {
      linesRes = wrapToLines(tokens, maxWidthUnits, trackingUnits, maxLines, group.breakLongWords, glyphs, fallbackKey, spaceKey);
      if (!linesRes.ok) return { ok: false, placements: [] };
    }

    const lines = linesRes.lines;
    // Must be placeable on fixed bottoms
    if (lines.length > bottomsPx.length) return { ok: false, placements: [] };
    if (!linesFitFixedBottoms(lines, bottomsPx, area, padding, gapPx, scale, trackingUnits, glyphs, fallbackKey, spaceKey)) {
      return { ok: false, placements: [] };
    }

    // Build placements line by line
    const placements = [];
    for (let li = 0; li < lines.length; li++) {
      const lineKeys = lines[li];
      const bottom = bottomsPx[li];

      // Measure line width in units to align
      const m = measureGlyphRunUnits(lineKeys, trackingUnits, glyphs, fallbackKey, spaceKey);
      const lineWidthPx = m.width * scale;

      let xStart;
      if (group.align === "center") {
        xStart = (area.left + area.right - lineWidthPx) / 2 + group.hOffsetPx;
      } else if (group.align === "right") {
        xStart = (area.right - padding - lineWidthPx) + group.hOffsetPx;
      } else {
        xStart = (area.left + padding) + group.hOffsetPx;
      }

      let xEdge = xStart;

      for (let gi = 0; gi < lineKeys.length; gi++) {
        const key = lineKeys[gi];
        const entry = resolveGlyphEntry(key, glyphs, fallbackKey);
        if (!entry) continue;
        const g = entry.glyph;

        const x = xEdge + g.edges.L * scale;
        const y = bottom - g.edges.B * scale;

        const finalX = group.pixelSnap ? snapToDPR(x) : x;
        const finalY = group.pixelSnap ? snapToDPR(y) : y;

        // Render only if glyph has a path (space is empty)
        if (g.svg && g.svg.pathD) {
          placements.push({
            key: entry.key,
            x: finalX,
            y: finalY,
            s: scale,
            opacity: group.opacity
          });
        }

        // advance
        const advUnits = (g.edges.L + g.edges.R);
        xEdge += advUnits * scale;
        if (gi !== lineKeys.length - 1) xEdge += trackingUnits * scale;
      }
    }

    return { ok: true, placements, lines, bottomsPx };
  }

  // Fit scale for group:
  // - if wrap not allowed => direct min scale from width + fixed-bottom vertical constraint
  // - if wrap allowed => binary search max scale that fits wrapping+fixed-bottoms
  function fitScaleForGroup(group, glyphs, fallbackKey, spaceKey) {
    const area = getAreaRect(group);
    const padding = group.paddingPx;
    const trackingUnits = group.trackingUnits;

    const maxLines = Math.max(1, Math.min(group.maxLines, group.lineBottomOffsetsPx.length));
    const bottomsPx = group.lineBottomOffsetsPx.slice(0, maxLines).map(off => group.originY + off);

    const usableWpx = (area.right - area.left) - 2 * padding;
    const usableTop = area.top + padding;
    const usableBottom = area.bottom - padding;

    if (usableWpx <= 1) return 0;

    const wrapAllowed = group.allowWrap && maxLines > 1;

    // Helper to test fit at scale
    function fits(scale) {
      if (scale <= 0) return false;
      const res = buildPlacementsForGroup(group, scale, glyphs, fallbackKey, spaceKey);
      return res.ok;
    }

    if (!wrapAllowed) {
      // Flatten everything onto one line
      const tokens = tokenize(group.text, glyphs, fallbackKey, spaceKey);
      const flat = [];
      for (const t of tokens) {
        if (t.type === "newline") { flat.push(spaceKey); continue; }
        if (t.glyphKeys) for (const k of t.glyphKeys) flat.push(k);
      }
      while (flat.length && isSpaceGlyphKey(flat[0], spaceKey)) flat.shift();
      while (flat.length && isSpaceGlyphKey(flat[flat.length - 1], spaceKey)) flat.pop();

      const m = measureGlyphRunUnits(flat, trackingUnits, glyphs, fallbackKey, spaceKey);
      const widthUnits = m.width;
      const heightUnits = m.height;

      if (widthUnits <= 0 || heightUnits <= 0) return 1;

      // Width constraint
      const sW = usableWpx / widthUnits;

      // Vertical constraint: must fit above first line bottom
      const bottom0 = bottomsPx[0] ?? (group.originY);
      if (bottom0 > usableBottom) return 0;
      const allowedHpx = bottom0 - usableTop;
      const sH = allowedHpx / heightUnits;

      const s = Math.max(0, Math.min(sW, sH));
      return s;
    }

    // Wrap allowed: find an upper bound and then binary search
    // Start from a conservative upper bound based on fitting first line only (nowrap)
    const tokens = tokenize(group.text, glyphs, fallbackKey, spaceKey);
    const flat = [];
    for (const t of tokens) {
      if (t.type === "newline") { flat.push(spaceKey); continue; }
      if (t.glyphKeys) for (const k of t.glyphKeys) flat.push(k);
    }
    while (flat.length && isSpaceGlyphKey(flat[0], spaceKey)) flat.shift();
    while (flat.length && isSpaceGlyphKey(flat[flat.length - 1], spaceKey)) flat.pop();

    const m0 = measureGlyphRunUnits(flat, trackingUnits, glyphs, fallbackKey, spaceKey);
    let hi = usableWpx / Math.max(1e-9, m0.width);
    // Also bound by vertical space to first bottom
    const bottom0 = bottomsPx[0] ?? group.originY;
    const allowedHpx = (bottom0 - usableTop);
    hi = Math.min(hi, allowedHpx / Math.max(1e-9, m0.height));
    if (!isFinite(hi) || hi <= 0) hi = 1;

    // If hi fits, grow it a bit (up to a cap) so we can maximize
    let cap = 8;
    while (cap-- > 0 && fits(hi)) {
      hi *= 1.5;
      if (hi > 50) break;
    }
    let lo = 0;
    let best = 0;

    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) {
        best = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }

    return best;
  }

  function clearStage(stage) {
    while (stage.firstChild) stage.removeChild(stage.firstChild);
  }

  function drawRect(stage, x, y, w, h, attrs) {
    const r = svgEl("rect");
    r.setAttribute("x", x);
    r.setAttribute("y", y);
    r.setAttribute("width", w);
    r.setAttribute("height", h);
    for (const [k, v] of Object.entries(attrs || {})) r.setAttribute(k, v);
    if (!attrs || !Object.prototype.hasOwnProperty.call(attrs, "pointer-events")) r.setAttribute("pointer-events", "none");
    stage.appendChild(r);
  }

  function drawLine(stage, x1, y1, x2, y2, attrs) {
    const l = svgEl("line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1);
    l.setAttribute("x2", x2); l.setAttribute("y2", y2);
    for (const [k, v] of Object.entries(attrs || {})) l.setAttribute(k, v);
    if (!attrs || !Object.prototype.hasOwnProperty.call(attrs, "pointer-events")) l.setAttribute("pointer-events", "none");
    stage.appendChild(l);
  }

  function buildDefs(stage, glyphs, glyphKeys) {
    const prior = stage.querySelector("defs[data-atlas-defs=\"true\"]");
    if (prior) prior.remove();
    const defs = svgEl("defs");
    defs.setAttribute("data-atlas-defs", "true");
    const keys = glyphKeys && glyphKeys.size ? Array.from(glyphKeys) : Object.keys(glyphs);
    for (const key of keys) {
      const g = glyphs[key];
      if (!g.svg || !g.svg.pathD) continue;
      const p = svgEl("path");
      p.setAttribute("id", key);
      p.setAttribute("d", g.svg.pathD);
      defs.appendChild(p);
    }
    stage.appendChild(defs);
  }

  function collectReferencedGlyphKeys(groups, glyphs, fallbackKey, spaceKey) {
    const keys = new Set();
    keys.add(spaceKey);
    if (hasRenderableGlyph(fallbackKey, glyphs)) keys.add(fallbackKey);
    for (const group of (groups || [])) {
      const tokens = tokenize(group.text || "", glyphs, fallbackKey, spaceKey);
      for (const t of tokens) {
        if (t.type === "newline") {
          keys.add(spaceKey);
          continue;
        }
        if (t.glyphKeys) {
          for (const k of t.glyphKeys) keys.add(k);
        }
      }
    }
    return keys;
  }

  function verifyGlyphCoverage(groups, glyphs, fallbackKey, spaceKey) {
    const missing = new Set();
    const textKeys = new Set();

    for (const group of (groups || [])) {
      const text = normalizeText(group.text || "");
      for (const ch of text) {
        const normalized = ch === "\t" ? " " : ch;
        if (normalized === "\n") {
          textKeys.add(spaceKey);
          continue;
        }
        textKeys.add(keyForChar(normalized));
      }
    }

    textKeys.add(spaceKey);
    if (hasRenderableGlyph(fallbackKey, glyphs)) textKeys.add(fallbackKey);

    for (const key of textKeys) {
      if (!hasRenderableGlyph(key, glyphs)) missing.add(key);
    }

    if (missing.size) {
      const list = Array.from(missing).sort().join(", ");
      console.warn(`[atlas-svg-renderer] Missing glyph svg.pathD for: ${list}. Using fallback where possible.`);
    }
  }

  // Flatten text into a single glyph-run (newlines treated as spaces) and trim outer spaces.
  function flattenGlyphKeysSingleLine(text, glyphs, fallbackKey, spaceKey) {
    const tokens = tokenize(text || "", glyphs, fallbackKey, spaceKey);
    const flat = [];
    for (const t of tokens) {
      if (t.type === "newline") { flat.push(spaceKey); continue; }
      if (t.glyphKeys) for (const k of t.glyphKeys) flat.push(k);
    }
    while (flat.length && isSpaceGlyphKey(flat[0], spaceKey)) flat.shift();
    while (flat.length && isSpaceGlyphKey(flat[flat.length - 1], spaceKey)) flat.pop();
    return flat;
  }

  // Build placements for a "button label" that is vertically centered within the group's area.
  // This ignores fixed line bottoms; it's meant for UI buttons rather than text blocks.
  function buildButtonLabelPlacements(group, area, glyphs, fallbackKey, spaceKey) {
    const padding = Number(group.paddingPx ?? 12);
    const trackingUnits = Number(group.trackingUnits ?? 6);

    const keys = flattenGlyphKeysSingleLine(group.text || "", glyphs, fallbackKey, spaceKey);
    if (!keys.length) return { ok: false, placements: [] };

    const m = measureGlyphRunUnits(keys, trackingUnits, glyphs, fallbackKey, spaceKey);
    if (m.width <= 0 || m.height <= 0) return { ok: false, placements: [] };

    const availWpx = (area.right - area.left) - 2 * padding;
    const availHpx = (area.bottom - area.top) - 2 * padding;
    if (availWpx <= 1 || availHpx <= 1) return { ok: false, placements: [] };

    let scale = Math.min(availWpx / m.width, availHpx / m.height);
    if (!Number.isFinite(scale) || scale <= 0) return { ok: false, placements: [] };

    // Compute horizontal start based on alignment (default to center for buttons).
    const lineWidthPx = m.width * scale;
    const align = group.align || "center";
    const hOffsetPx = Number(group.hOffsetPx ?? 0);

    let xStart;
    if (align === "right") {
      xStart = (area.right - padding - lineWidthPx) + hOffsetPx;
    } else if (align === "left") {
      xStart = (area.left + padding) + hOffsetPx;
    } else {
      xStart = (area.left + area.right - lineWidthPx) / 2 + hOffsetPx;
    }

    // Vertically center the line by centering the line's slot-height (T+B) inside the rect.
    const heightPx = m.height * scale;
    const centerY = (area.top + area.bottom) / 2;
    const bottom = centerY + heightPx / 2;

    const placements = [];
    let xEdge = xStart;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const entry = resolveGlyphEntry(key, glyphs, fallbackKey);
      if (!entry) continue;
      const g = entry.glyph;

      const x = xEdge + g.edges.L * scale;
      const y = bottom - g.edges.B * scale;

      const finalX = group.pixelSnap ? snapToDPR(x) : x;
      const finalY = group.pixelSnap ? snapToDPR(y) : y;

      if (g.svg && g.svg.pathD) {
        placements.push({
          key: entry.key,
          x: finalX,
          y: finalY,
          s: scale,
          opacity: group.opacity
        });
      }

      const advUnits = (g.edges.L + g.edges.R);
      xEdge += advUnits * scale;
      if (i !== keys.length - 1) xEdge += trackingUnits * scale;
    }

    return { ok: true, placements };
  }

  function renderTextGroup(group, area, opts) {
    const scale = fitScaleForGroup(group, opts.glyphs, opts.fallbackKey, opts.spaceKey);
    if (scale <= 0) return null;

    const layout = buildPlacementsForGroup(group, scale, opts.glyphs, opts.fallbackKey, opts.spaceKey);
    if (!layout.ok || !layout.placements || !layout.placements.length) return null;

    const guidesOn = opts.globalGuides || group.showGuides;

    if (guidesOn) {
      // line bottoms
      for (let i = 0; i < layout.bottomsPx.length; i++) {
        const y = layout.bottomsPx[i];
        drawLine(opts.stage, area.left, y, area.right, y, {
          stroke: "rgba(0, 220, 255, .35)",
          "stroke-width": "1",
          "stroke-dasharray": "4 6"
        });
      }
    }

    // Render the group's glyphs into an SVG group so we can optionally make the rendered content clickable.
    const gEl = svgEl("g");
    gEl.setAttribute("data-group-id", group.id);

    for (const pl of layout.placements) {
      const use = svgEl("use");
      use.setAttribute("href", "#" + pl.key);
      use.setAttribute("transform", `translate(${pl.x} ${pl.y}) scale(${pl.s})`);
      use.setAttribute("fill", "rgba(235,240,255,.95)");
      use.setAttribute("opacity", String(pl.opacity));
      gEl.appendChild(use);
    }

    opts.stage.appendChild(gEl);

    // Debug guides (slot/ink boxes) should sit above the glyphs; draw them after appending gEl.
    if (guidesOn) {
      for (const pl of layout.placements) {
        const g = opts.glyphs[pl.key];
        // slot box (blue)
        const L = g.edges.L * pl.s;
        const R = g.edges.R * pl.s;
        const T = g.edges.T * pl.s;
        const B = g.edges.B * pl.s;
        drawRect(opts.stage, pl.x - L, pl.y - T, L + R, T + B, {
          fill: "none",
          stroke: "rgba(90,150,255,.35)",
          "stroke-dasharray": "3 4",
          "stroke-width": "1"
        });
        // ink box (amber), if any
        if (g.ink && (g.ink.w || g.ink.h)) {
          drawRect(opts.stage, pl.x + g.ink.x * pl.s, pl.y + g.ink.y * pl.s, g.ink.w * pl.s, g.ink.h * pl.s, {
            fill: "none",
            stroke: "rgba(255,190,60,.35)",
            "stroke-dasharray": "2 4",
            "stroke-width": "1"
          });
        }
      }
    }

    // Optional: treat the *rendered content* as a button (hitbox around the rendered glyph bounds).
    const label = (group.text || "").trim();
    if (!group.contentAsButton || !label) return gEl;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pl of layout.placements) {
      const g = opts.glyphs[pl.key];
      const L = g.edges.L * pl.s;
      const R = g.edges.R * pl.s;
      const T = g.edges.T * pl.s;
      const B = g.edges.B * pl.s;
      minX = Math.min(minX, pl.x - L);
      maxX = Math.max(maxX, pl.x + R);
      minY = Math.min(minY, pl.y - T);
      maxY = Math.max(maxY, pl.y + B);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return gEl;

    const pad = 5;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;

    gEl.setAttribute("class", "contentButton");
    gEl.setAttribute("role", "button");
    gEl.setAttribute("tabindex", "0");
    gEl.setAttribute("aria-label", (group.name || group.id || "content").toString());

    const title = svgEl("title");
    title.textContent = (group.name || group.id || "content").toString();
    gEl.insertBefore(title, gEl.firstChild);

    const hit = svgEl("rect");
    hit.setAttribute("class", "contentHit");
    hit.setAttribute("x", String(minX));
    hit.setAttribute("y", String(minY));
    hit.setAttribute("width", String(Math.max(1, maxX - minX)));
    hit.setAttribute("height", String(Math.max(1, maxY - minY)));
    hit.setAttribute("rx", "10");
    hit.setAttribute("ry", "10");
    hit.setAttribute("tabindex", "0");
    hit.setAttribute("role", "button");
    hit.setAttribute("aria-label", (group.name || group.id || "content").toString());
    // pointer-events is handled by CSS (.contentHit)
    gEl.appendChild(hit);

    function fire(ev) {
      if (typeof opts.onGroupAction === "function") {
        opts.onGroupAction({
          groupId: group.id,
          group,
          source: "content",
          originalEvent: ev
        });
      }
    }

    hit.addEventListener("click", (e) => {
      e.preventDefault();
      fire(e);
    });
    hit.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fire(e);
      }
    });

    return gEl;
  }

  function renderButtonGroup(group, area, opts) {
    const guidesOn = opts.globalGuides || group.showGuides;
    const selected = typeof opts.selectedGroupId !== "undefined" && group.id === opts.selectedGroupId;
    const label = (group.text || "").trim();

    // If the label is empty, keep it "inert" unless guides or selection are on.
    if (!label && !guidesOn && !selected) return null;

    const w = area.right - area.left;
    const h = area.bottom - area.top;

    const gEl = svgEl("g");
    gEl.setAttribute("class", "uiButton");
    gEl.setAttribute("data-group-id", group.id);
    gEl.setAttribute("data-ui-role", "button");
    if (group.dataRole) gEl.setAttribute("data-role", group.dataRole);
    if (group.actionKey) gEl.setAttribute("data-action-key", group.actionKey);
    gEl.setAttribute("role", "button");
    gEl.setAttribute("tabindex", "0");
    gEl.setAttribute("aria-label", (group.name || group.id || "button").toString());
    gEl.setAttribute("style", "cursor:pointer;");

    const title = svgEl("title");
    title.textContent = (group.name || group.id || "button").toString();
    gEl.appendChild(title);

    const rect = svgEl("rect");
    rect.setAttribute("x", area.left);
    rect.setAttribute("y", area.top);
    rect.setAttribute("width", w);
    rect.setAttribute("height", h);
    rect.setAttribute("rx", String(Math.min(14, h / 2)));
    rect.setAttribute("ry", String(Math.min(14, h / 2)));
    rect.setAttribute("fill", "rgba(255,255,255,.045)");
    rect.setAttribute("stroke", selected ? "rgba(119,167,255,.85)" : "rgba(255,255,255,.22)");
    rect.setAttribute("stroke-width", selected ? "2" : "1");
    rect.setAttribute("pointer-events", "all");
    gEl.appendChild(rect);

    if (label) {
      const lbl = buildButtonLabelPlacements(group, area, opts.glyphs, opts.fallbackKey, opts.spaceKey);
      if (lbl.ok) {
        for (const pl of lbl.placements) {
          const use = svgEl("use");
          use.setAttribute("href", "#" + pl.key);
          use.setAttribute("transform", `translate(${pl.x} ${pl.y}) scale(${pl.s})`);
          use.setAttribute("fill", "rgba(235,240,255,.95)");
          use.setAttribute("opacity", String(pl.opacity));
          gEl.appendChild(use);
        }
      }
    } else if (guidesOn) {
      // subtle placeholder when guides are on
      const hint = svgEl("text");
      hint.setAttribute("x", String((area.left + area.right) / 2));
      hint.setAttribute("y", String((area.top + area.bottom) / 2));
      hint.setAttribute("text-anchor", "middle");
      hint.setAttribute("dominant-baseline", "middle");
      hint.setAttribute("fill", "rgba(255,255,255,.35)");
      hint.setAttribute("font-size", "12");
      hint.textContent = "(button: empty label)";
      gEl.appendChild(hint);
    }

    function fire(ev) {
      if (typeof opts.onGroupAction === "function") {
        opts.onGroupAction({
          groupId: group.id,
          group,
          source: "button",
          originalEvent: ev
        });
      }
    }

    gEl.addEventListener("click", (e) => {
      e.preventDefault();
      fire(e);
    });
    gEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fire(e);
      }
    });

    opts.stage.appendChild(gEl);
    return gEl;
  }

  function renderAtlasGroups({ svgEl: stage, atlas, groups, viewBoxSize, onGroupAction, globalGuides = false, selectedGroupId } = {}) {
    if (!stage) throw new Error("renderAtlasGroups: svgEl is required");
    if (!atlas || !atlas.glyphs) throw new Error("renderAtlasGroups: missing atlas data");
    const glyphs = atlas.glyphs;
    const FALLBACK_KEY = "U003F"; // '?'
    const SPACE_KEY = "U0020";
    const fallbackKey = FALLBACK_KEY;
    const spaceKey = SPACE_KEY;

    let resolvedViewBox = viewBoxSize;
    if (!resolvedViewBox || !Number.isFinite(resolvedViewBox.width) || !Number.isFinite(resolvedViewBox.height)) {
      if (typeof stage.getBoundingClientRect === "function") {
        const rect = stage.getBoundingClientRect();
        if (rect && Number.isFinite(rect.width) && Number.isFinite(rect.height)) {
          resolvedViewBox = { width: rect.width, height: rect.height };
        }
      }
    }

    if (resolvedViewBox && resolvedViewBox.width && resolvedViewBox.height) {
      const viewBoxX = Number.isFinite(resolvedViewBox.x) ? resolvedViewBox.x : 0;
      const viewBoxY = Number.isFinite(resolvedViewBox.y) ? resolvedViewBox.y : 0;
      stage.setAttribute("viewBox", `${viewBoxX} ${viewBoxY} ${Math.max(1, resolvedViewBox.width)} ${Math.max(1, resolvedViewBox.height)}`);
    }

    const svgRoot = (stage instanceof SVGSVGElement) ? stage : stage.ownerSVGElement;
    if (!svgRoot) throw new Error("renderAtlasGroups: svgEl must be an <svg> element or have an ownerSVGElement");

    verifyGlyphCoverage(groups, glyphs, fallbackKey, spaceKey);
    clearStage(stage);
    const referencedKeys = collectReferencedGlyphKeys(groups, glyphs, fallbackKey, spaceKey);
    buildDefs(svgRoot, glyphs, referencedKeys);

    const opts = {
      stage,
      glyphs,
      fallbackKey,
      spaceKey,
      onGroupAction,
      globalGuides,
      selectedGroupId
    };

    const groupElements = new Map();

    for (const group of (groups || [])) {
      const area = getAreaRect(group);

      if (globalGuides || group.showGuides) {
        // area box
        drawRect(stage, area.left, area.top, area.right - area.left, area.bottom - area.top, {
          fill: "none",
          stroke: "rgba(255,255,255,.25)",
          "stroke-dasharray": "6 6",
          "stroke-width": "1"
        });
        // origin crosshair
        drawLine(stage, group.originX - 6, group.originY, group.originX + 6, group.originY, {
          stroke: "rgba(255,255,255,.22)", "stroke-width": "1"
        });
        drawLine(stage, group.originX, group.originY - 6, group.originX, group.originY + 6, {
          stroke: "rgba(255,255,255,.22)", "stroke-width": "1"
        });
      }

      const kind = (group.uiRole || "text");
      let gEl = null;

      if (kind === "button") {
        gEl = renderButtonGroup(group, area, opts);
      } else {
        gEl = renderTextGroup(group, area, opts);
      }

      if (gEl) groupElements.set(group.id, gEl);
    }

    return { groupElements };
  }

  window.renderAtlasGroups = renderAtlasGroups;
  window.AtlasSvgRenderer = {
    renderAtlasGroups
  };
})();
