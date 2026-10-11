// Workbench: tabs, analysis, edit preview/export.
(function () {
  const photo = window.PM_PHOTO;
  if (!photo || !window.PM || !window.PM.edit) return;

  const edit = window.PM.edit;
  const errorEl = document.getElementById('wb-error');
  let recipe = edit.normalizeRecipe(window.PM_RECIPE || {});
  let savedRecipe = JSON.parse(JSON.stringify(recipe));
  let editMode = false;

  function setError(message) {
    errorEl.textContent = message || '';
    errorEl.classList.toggle('hidden', !message);
  }

  // ---- tabs ----
  function activateTab(key) {
    document.querySelectorAll('.tab-button').forEach(function (b) {
      const active = b.getAttribute('data-tab') === key;
      b.setAttribute('aria-selected', active ? 'true' : 'false');
      b.className =
        'tab-button px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors duration-200 ' +
        (active ? 'border-accent text-ink font-medium' : 'border-transparent text-body hover:text-ink');
    });
    document.querySelectorAll('[data-tab-panel]').forEach(function (panel) {
      panel.classList.toggle('hidden', panel.getAttribute('data-tab-panel') !== key);
      panel.classList.toggle('flex', panel.getAttribute('data-tab-panel') === key);
    });
  }

  document.querySelectorAll('.tab-button').forEach(function (button) {
    button.addEventListener('click', function () {
      activateTab(button.getAttribute('data-tab'));
    });
  });

  document.querySelectorAll('[data-focus-region]').forEach(function (button) {
    button.addEventListener('click', function () {
      const id = button.getAttribute('data-focus-region');
      document.querySelectorAll('[data-finding]').forEach(function (row) {
        row.classList.toggle('bg-page', row.getAttribute('data-finding') === id);
      });
      const box = document.querySelector('[data-region="' + id + '"]');
      if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  // ---- annotation popover: click a highlighted box to read that spot's comment in place ----
  const popover = document.getElementById('region-popover');
  const stage = document.getElementById('annotation-stage');

  function hidePopover() {
    if (popover) popover.classList.add('hidden');
  }

  if (popover) {
    document.addEventListener('click', function (event) {
      if (popover.classList.contains('hidden')) return;
      if (event.target.closest('#region-popover') || event.target.closest('.region-box')) return;
      hidePopover();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') hidePopover();
    });
  }

  function findingById(id) {
    return (window.PM_FINDINGS || []).find(function (item) {
      return item.id === id;
    });
  }

  function showPopover(box, finding) {
    if (!popover || !stage || !finding) return;
    const priorityLabel = { high: '优先级高', medium: '优先级中', low: '优先级低' }[finding.priority] || '优先级中';
    popover.innerHTML =
      '<p class="text-xs text-muted">' + priorityLabel + (finding.requiresReshoot ? ' · 需要重拍' : '') + '</p>' +
      '<p class="mt-1 text-sm font-medium text-ink">' + window.PM.escapeHtml(finding.title) + '</p>' +
      (finding.observation ? '<p class="mt-1 text-xs text-body">' + window.PM.escapeHtml(finding.observation) + '</p>' : '') +
      (finding.action ? '<p class="mt-2 text-xs text-ink">' + window.PM.escapeHtml(finding.action) + '</p>' : '') +
      '<button type="button" id="popover-detail" class="mt-2 text-xs text-accent hover:underline">查看完整点评 →</button>';
    popover.classList.remove('hidden');

    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    const popWidth = Math.min(260, stageWidth - 16);
    popover.style.width = popWidth + 'px';

    let left = box.offsetLeft + box.offsetWidth / 2 - popWidth / 2;
    left = Math.max(8, Math.min(left, stageWidth - popWidth - 8));
    let top = box.offsetTop + box.offsetHeight + 8;
    const popHeight = popover.offsetHeight;
    if (top + popHeight > stageHeight - 8) {
      top = Math.max(8, box.offsetTop - popHeight - 8);
    }
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';

    const detail = popover.querySelector('#popover-detail');
    if (detail)
      detail.addEventListener('click', function () {
        hidePopover();
        focusFinding(finding.id);
      });
  }

  function focusFinding(id) {
    const row = document.querySelector('[data-finding="' + id + '"]');
    if (!row) return;
    const panel = row.closest('[data-tab-panel]');
    if (panel) {
      // Switch tabs directly: a synthetic .click() would bubble to the document-level
      // "click outside" handler and immediately close the annotation popover.
      activateTab(panel.getAttribute('data-tab-panel'));
    }
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('bg-page');
  }
  window.PM_focusFinding = focusFinding;

  document.querySelectorAll('.region-box').forEach(function (box) {
    box.addEventListener('click', function () {
      const id = box.getAttribute('data-region');
      const finding = findingById(id);
      if (finding) showPopover(box, finding);
      focusFinding(id);
    });
  });

  // ---- analysis ----
  const goals = [];
  document.querySelectorAll('[data-goal]').forEach(function (button) {
    button.addEventListener('click', function () {
      const value = button.getAttribute('data-goal');
      const index = goals.indexOf(value);
      if (index >= 0) goals.splice(index, 1);
      else goals.push(value);
      const active = goals.indexOf(value) >= 0;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.className =
        'px-3 py-1.5 rounded-full text-sm border transition-colors duration-200 ' +
        (active ? 'bg-accent text-white border-accent' : 'bg-surface text-body border-line hover:bg-page');
    });
  });

  async function runAnalysis(force) {
    const sceneEl = document.getElementById('scene-select');
    const scene = sceneEl ? sceneEl.value : 'auto';
    setError(null);
    const button = force ? document.getElementById('reanalyze') : document.getElementById('start-analysis');
    if (button) {
      button.disabled = true;
      button.textContent = force ? '重新分析中…' : '正在分析…';
    }
    try {
      const result = await window.PM.postJson('/api/photos/' + photo.id + '/analysis', {
        scene: scene,
        goals: goals,
        force: !!force,
      });
      if (result.status === 'succeeded' || result.status === 'processing') {
        window.location.reload();
        return;
      }
      setError((result.error && result.error.message) || '分析失败');
    } catch (err) {
      setError(err.message);
    }
    if (button) {
      button.disabled = false;
      button.textContent = force ? '重新分析' : '开始分析';
    }
  }
  const startButton = document.getElementById('start-analysis');
  if (startButton) startButton.addEventListener('click', function () { runAnalysis(false); });
  const reanalyze = document.getElementById('reanalyze');
  if (reanalyze) reanalyze.addEventListener('click', function () { runAnalysis(true); });

  // ---- editing ----
  const viewPanel = document.getElementById('view-panel');
  const editPanel = document.getElementById('edit-panel');
  const editControls = document.getElementById('edit-controls');
  const canvas = document.getElementById('edit-canvas');
  const originalImage = document.getElementById('original-image');
  const compareButton = document.getElementById('toggle-compare');
  const toggleButton = document.getElementById('toggle-edit');
  const toggleLabel = document.getElementById('toggle-edit-label');
  let showOriginal = false;

  function syncSliders() {
    document.querySelectorAll('[data-slider]').forEach(function (input) {
      const key = input.getAttribute('data-slider');
      const value = recipe[key];
      input.value = value;
      const label = document.querySelector('[data-value="' + key + '"]');
      if (label) label.textContent = value;
    });
    const sliders = document.getElementById('crop-sliders');
    if (recipe.crop) {
      sliders.classList.remove('hidden');
      sliders.querySelectorAll('[data-crop]').forEach(function (input) {
        const key = input.getAttribute('data-crop');
        const percent = Math.round(recipe.crop[key] * 100);
        input.value = percent;
        const label = document.querySelector('[data-crop-value="' + key + '"]');
        if (label) label.textContent = percent;
      });
    } else {
      sliders.classList.add('hidden');
    }
    const hint = document.getElementById('unsaved-hint');
    if (hint) hint.classList.toggle('hidden', JSON.stringify(recipe) === JSON.stringify(savedRecipe));
  }

  async function redraw() {
    if (!canvas) return;
    try {
      await edit.renderToCanvas(canvas, photo.mediaUrl, recipe);
    } catch (err) {
      setError(err.message);
    }
  }

  document.querySelectorAll('[data-slider]').forEach(function (input) {
    input.addEventListener('input', function () {
      recipe[input.getAttribute('data-slider')] = Number(input.value);
      syncSliders();
      redraw();
    });
  });

  document.querySelectorAll('[data-crop]').forEach(function (input) {
    input.addEventListener('input', function () {
      if (!recipe.crop) recipe.crop = { x: 0, y: 0, width: 1, height: 1 };
      const key = input.getAttribute('data-crop');
      const percent = Number(input.value) / 100;
      recipe.crop[key] = percent;
      recipe.crop = edit.normalizeCrop(recipe.crop) || recipe.crop;
      syncSliders();
      redraw();
    });
  });

  const cropNone = document.getElementById('crop-none');
  if (cropNone) cropNone.addEventListener('click', function () { recipe.crop = null; syncSliders(); redraw(); });
  const cropSuggest = document.getElementById('crop-suggest');
  if (cropSuggest)
    cropSuggest.addEventListener('click', function () {
      recipe.crop = window.PM_RECOMMENDED_CROP;
      syncSliders();
      redraw();
    });

  const applyRecommended = document.getElementById('apply-recommended');
  if (applyRecommended)
    applyRecommended.addEventListener('click', function () {
      if (!window.PM_RECOMMENDED_RECIPE) return;
      recipe = edit.normalizeRecipe(window.PM_RECOMMENDED_RECIPE);
      syncSliders();
      redraw();
    });

  // ---- score radar chart (pure SVG, no dependency) ----
  function drawRadar() {
    const svg = document.getElementById('score-radar');
    const score = window.PM_SCORE;
    if (!svg) return;
    const dims = score && Array.isArray(score.dimensions) ? score.dimensions : [];
    if (dims.length < 3) {
      svg.style.display = 'none';
      return;
    }
    const size = 220;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 78;
    const angle = function (i) {
      return -Math.PI / 2 + (2 * Math.PI * i) / dims.length;
    };
    const point = function (i, r) {
      return [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
    };
    const desc = dims
      .map(function (d) {
        return d.label + ' ' + d.score + ' 分';
      })
      .join('，');
    const parts = [
      '<title>分维度评分雷达图</title>',
      '<desc>' + window.PM.escapeHtml('五个维度的参考评分：' + desc) + '</desc>',
    ];
    [0.25, 0.5, 0.75, 1].forEach(function (level) {
      const pts = dims
        .map(function (_, i) {
          const p = point(i, radius * level);
          return p[0].toFixed(1) + ',' + p[1].toFixed(1);
        })
        .join(' ');
      parts.push('<polygon points="' + pts + '" fill="none" stroke="#d2d2d7" stroke-width="1"/>');
    });
    dims.forEach(function (_, i) {
      const p = point(i, radius);
      parts.push(
        '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="#d2d2d7" stroke-width="1"/>',
      );
    });
    const ratio = function (value) {
      return Math.max(0, Math.min(100, Number(value) || 0)) / 100;
    };
    const dataPoints = dims
      .map(function (d, i) {
        const p = point(i, radius * ratio(d.score));
        return p[0].toFixed(1) + ',' + p[1].toFixed(1);
      })
      .join(' ');
    parts.push('<polygon points="' + dataPoints + '" fill="rgba(0,113,227,0.16)" stroke="#0071e3" stroke-width="2"/>');
    dims.forEach(function (d, i) {
      const p = point(i, radius * ratio(d.score));
      parts.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#0071e3"/>');
    });
    dims.forEach(function (d, i) {
      const p = point(i, radius + 16);
      parts.push(
        '<text x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#515154">' +
          window.PM.escapeHtml(d.label) +
          '</text>',
      );
    });
    svg.innerHTML = parts.join('');
  }
  drawRadar();

  // ---- before/after comparison (from ?compare=<photoId>) ----
  (function () {
    const box = document.querySelector('[data-testid="score-comparison"]');
    const deltaEl = document.getElementById('score-delta');
    if (!box || !deltaEl) return;
    const before = Number(box.getAttribute('data-before'));
    const after = Number(box.getAttribute('data-after'));
    if (!Number.isFinite(before) || !Number.isFinite(after)) return;
    const diff = after - before;
    if (diff > 0) {
      deltaEl.textContent = '（提升 +' + diff + ' 分）';
      deltaEl.className = 'font-semibold text-success';
    } else if (diff < 0) {
      deltaEl.textContent = '（下降 ' + diff + ' 分）';
      deltaEl.className = 'font-semibold text-danger';
    } else {
      deltaEl.textContent = '（分数持平）';
      deltaEl.className = 'font-semibold text-muted';
    }
  })();

  // ---- score preference: re-weight the overall score to match the user's priorities ----
  const PREFERENCE_WEIGHTS = {
    balanced: { composition: 0.25, light: 0.25, color: 0.15, subject: 0.2, background: 0.15 },
    composition: { composition: 0.4, light: 0.2, color: 0.1, subject: 0.2, background: 0.1 },
    light: { composition: 0.2, light: 0.4, color: 0.1, subject: 0.2, background: 0.1 },
    color: { composition: 0.2, light: 0.2, color: 0.4, subject: 0.1, background: 0.1 },
    subject: { composition: 0.2, light: 0.15, color: 0.1, subject: 0.45, background: 0.1 },
  };
  const PREFERENCE_KEY = 'pm-score-preference';
  let activePreference = 'balanced';
  // Account preference wins (syncs across devices); localStorage is the offline fallback.
  if (window.PM_PREFERENCE && PREFERENCE_WEIGHTS[window.PM_PREFERENCE]) {
    activePreference = window.PM_PREFERENCE;
  } else {
    try {
      const saved = window.localStorage.getItem(PREFERENCE_KEY);
      if (saved && PREFERENCE_WEIGHTS[saved]) activePreference = saved;
    } catch (err) {
      /* storage unavailable */
    }
  }

  function recomputeOverall() {
    const score = window.PM_SCORE;
    if (!score || !Array.isArray(score.dimensions) || score.dimensions.length === 0) return;
    const weights = PREFERENCE_WEIGHTS[activePreference] || PREFERENCE_WEIGHTS.balanced;
    let weighted = 0;
    let total = 0;
    score.dimensions.forEach(function (dim) {
      const weight = weights[dim.key] === undefined ? dim.weight : weights[dim.key];
      weighted += Number(dim.score) * weight;
      total += weight;
    });
    const overall = document.querySelector('[data-testid="score-overall"]');
    if (overall && total > 0) overall.textContent = String(Math.round(weighted / total));
    document.querySelectorAll('[data-dimension-weight]').forEach(function (node) {
      const key = node.closest('[data-dimension]') ? node.closest('[data-dimension]').getAttribute('data-dimension') : null;
      const dimScore = Number(node.getAttribute('data-score'));
      const weight = weights[key] === undefined ? Number(node.getAttribute('data-default-weight')) : weights[key];
      node.textContent = '× ' + weight + ' = ' + (dimScore * weight).toFixed(1);
    });
  }

  function applyPreference(key) {
    if (!PREFERENCE_WEIGHTS[key]) key = 'balanced';
    activePreference = key;
    try {
      window.localStorage.setItem(PREFERENCE_KEY, key);
    } catch (err) {
      /* ignore */
    }
    // Persist to the account so the choice follows the user across devices.
    window.PM.putJson('/api/me/preferences', { scorePreference: key }).catch(function () {});
    document.querySelectorAll('[data-preference]').forEach(function (button) {
      const active = button.getAttribute('data-preference') === key;
      button.className =
        'rounded-full px-3 py-1 text-xs border transition-colors duration-200 ' +
        (active ? 'bg-accent text-white border-accent' : 'bg-surface text-body border-line hover:bg-page');
    });
    recomputeOverall();
  }

  document.querySelectorAll('[data-preference]').forEach(function (button) {
    button.addEventListener('click', function () {
      applyPreference(button.getAttribute('data-preference'));
    });
  });
  applyPreference(activePreference);

  // ---- score history + trend ----
  async function loadHistory() {
    const wrap = document.getElementById('score-history');
    if (!wrap) return;
    let items = [];
    try {
      const data = await window.PM.apiFetch('/api/photos/' + photo.id + '/history');
      items = (data.history || []).filter(function (item) {
        return item.status === 'succeeded';
      });
    } catch (err) {
      return;
    }
    if (items.length < 2) return;
    wrap.classList.remove('hidden');

    // trend line (oldest -> newest, only points that actually have a score)
    const withScore = items
      .slice()
      .reverse()
      .filter(function (item) {
        return typeof item.overall === 'number';
      });
    const trend = document.getElementById('score-history-trend');
    if (trend && withScore.length >= 2) {
      const W = 560;
      const H = 120;
      const pad = 16;
      const step = withScore.length > 1 ? (W - pad * 2) / (withScore.length - 1) : 0;
      const yFor = function (value) {
        return pad + (H - pad * 2) * (1 - Math.max(0, Math.min(100, value)) / 100);
      };
      const points = withScore
        .map(function (item, index) {
          return (pad + index * step).toFixed(1) + ',' + yFor(item.overall).toFixed(1);
        })
        .join(' ');
      const circles = withScore
        .map(function (item, index) {
          return (
            '<circle cx="' + (pad + index * step).toFixed(1) + '" cy="' + yFor(item.overall).toFixed(1) + '" r="4" fill="#0071e3"/>' +
            '<text x="' + (pad + index * step).toFixed(1) + '" y="' + (yFor(item.overall) - 10).toFixed(1) + '" text-anchor="middle" font-size="11" fill="#515154">' + item.overall + '</text>'
          );
        })
        .join('');
      trend.innerHTML =
        '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="分数趋势" class="max-w-full">' +
        '<line x1="' + pad + '" y1="' + yFor(0) + '" x2="' + (W - pad) + '" y2="' + yFor(0) + '" stroke="#d2d2d7"/>' +
        '<line x1="' + pad + '" y1="' + yFor(100) + '" x2="' + (W - pad) + '" y2="' + yFor(100) + '" stroke="#d2d2d7"/>' +
        '<polyline points="' + points + '" fill="none" stroke="#0071e3" stroke-width="2"/>' +
        circles +
        '</svg>';
    }

    const list = document.getElementById('score-history-list');
    if (list) {
      list.innerHTML = items
        .slice(0, 10)
        .map(function (item) {
          const scoreText = typeof item.overall === 'number' ? item.overall + ' 分' : '未评分';
          const modeText = item.mode === 'live' ? '真实' : '演示';
          return (
            '<li class="rounded-card border border-line bg-surface p-3 text-sm">' +
            '<div class="flex items-center justify-between gap-3">' +
            '<span class="text-ink">' + scoreText + '</span>' +
            '<span class="text-xs text-muted">' + window.PM.formatDate(item.createdAt) + ' · ' + modeText + '</span>' +
            '</div>' +
            (item.summary ? '<p class="mt-1 text-xs text-muted line-clamp-2">' + window.PM.escapeHtml(item.summary) + '</p>' : '') +
            '</li>'
          );
        })
        .join('');
    }
  }
  void loadHistory();

  // ---- export score card as PNG (canvas, no external dependency) ----
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth, maxLines) {
    const lines = [];
    let current = '';
    for (const char of String(text || '')) {
      const candidate = current + char;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = char;
        if (lines.length >= maxLines) break;
      } else {
        current = candidate;
      }
    }
    if (lines.length < maxLines && current) lines.push(current);
    if (lines.length === maxLines) {
      const last = lines[maxLines - 1];
      if (ctx.measureText(last + '…').width <= maxWidth) lines[maxLines - 1] = last + '…';
    }
    return lines;
  }

  function exportScoreCard() {
    const score = window.PM_SCORE;
    if (!score) return;
    const W = 900;
    const H = 960;
    const dpr = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const fontFamily = '-apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#f5f5f7';
    ctx.fillRect(0, 0, W, H);
    roundRect(ctx, 24, 24, W - 48, H - 48, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const left = 64;
    let y = 96;

    ctx.fillStyle = '#1d1d1f';
    ctx.font = '600 26px ' + fontFamily;
    ctx.fillText('PhotoMaster · AI 参考评分', left, y);
    y += 30;
    ctx.fillStyle = '#6e6e73';
    ctx.font = '14px ' + fontFamily;
    ctx.fillText(score.scale || '0-100（主观参考分）', left, y);
    y += 48;

    // overall
    const exportOverall = (function () {
      const dims0 = Array.isArray(score.dimensions) ? score.dimensions : [];
      if (!dims0.length) return score.overall === undefined ? null : score.overall;
      const activeWeights = PREFERENCE_WEIGHTS[activePreference] || PREFERENCE_WEIGHTS.balanced;
      let weighted = 0;
      let total = 0;
      dims0.forEach(function (d) {
        const weight = activeWeights[d.key] === undefined ? Number(d.weight) : activeWeights[d.key];
        weighted += Number(d.score) * weight;
        total += weight;
      });
      return total > 0 ? Math.round(weighted / total) : (score.overall === undefined ? null : score.overall);
    })();
    ctx.fillStyle = '#1d1d1f';
    ctx.font = '700 64px ' + fontFamily;
    ctx.fillText(String(exportOverall === null || exportOverall === undefined ? '—' : exportOverall), left, y);
    const overallWidth = ctx.measureText(String(exportOverall ?? '—')).width;
    ctx.fillStyle = '#6e6e73';
    ctx.font = '18px ' + fontFamily;
    ctx.fillText('/ 100', left + overallWidth + 12, y);
    y += 26;

    if (score.summary) {
      ctx.fillStyle = '#515154';
      ctx.font = '15px ' + fontFamily;
      for (const line of wrapText(ctx, score.summary, W - left * 2, 2)) {
        ctx.fillText(line, left, y);
        y += 22;
      }
    }
    y += 12;

    // radar
    const dims = Array.isArray(score.dimensions) ? score.dimensions : [];
    if (dims.length >= 3) {
      const cx = left + 130;
      const cy = y + 130;
      const radius = 108;
      const angle = (i) => -Math.PI / 2 + (2 * Math.PI * i) / dims.length;
      const point = (i, r) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
      ctx.strokeStyle = '#d2d2d7';
      ctx.lineWidth = 1;
      [0.25, 0.5, 0.75, 1].forEach((level) => {
        ctx.beginPath();
        dims.forEach((_, i) => {
          const p = point(i, radius * level);
          if (i === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        });
        ctx.closePath();
        ctx.stroke();
      });
      dims.forEach((_, i) => {
        const p = point(i, radius);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
      });
      ctx.beginPath();
      dims.forEach((d, i) => {
        const p = point(i, radius * (Math.max(0, Math.min(100, Number(d.score) || 0)) / 100));
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,113,227,0.16)';
      ctx.fill();
      ctx.strokeStyle = '#0071e3';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#515154';
      ctx.font = '13px ' + fontFamily;
      dims.forEach((d, i) => {
        const p = point(i, radius + 18);
        ctx.textAlign = 'center';
        ctx.fillText(String(d.label), p[0], p[1] + 4);
        ctx.textAlign = 'left';
      });
      // dimension values to the right of the radar
      let dy = y + 24;
      const activeWeights = PREFERENCE_WEIGHTS[activePreference] || PREFERENCE_WEIGHTS.balanced;
      dims.forEach((d) => {
        const weight = activeWeights[d.key] === undefined ? Number(d.weight) : activeWeights[d.key];
        ctx.fillStyle = '#1d1d1f';
        ctx.font = '15px ' + fontFamily;
        ctx.fillText(d.label, left + 300, dy);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#1d1d1f';
        ctx.font = '600 15px ' + fontFamily;
        ctx.fillText(String(d.score), W - left, dy);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0071e3';
        ctx.fillRect(left + 300, dy + 8, (W - left - 60 - 300) * (Math.max(0, Math.min(100, Number(d.score) || 0)) / 100), 6);
        ctx.fillStyle = '#f5f5f7';
        ctx.fillRect(left + 300 + (W - left - 60 - 300) * (Math.max(0, Math.min(100, Number(d.score) || 0)) / 100), dy + 8, (W - left - 60 - 300) * (1 - Math.max(0, Math.min(100, Number(d.score) || 0)) / 100), 6);
        ctx.fillStyle = '#6e6e73';
        ctx.font = '12px ' + fontFamily;
        ctx.fillText('× ' + weight + ' = ' + (Number(d.score) * weight).toFixed(1), left + 300, dy + 30);
        dy += 54;
      });
      y = Math.max(cy + radius + 40, dy + 10);
    }

    // pros / cons
    const drawList = (title, items, color, sign) => {
      ctx.fillStyle = color;
      ctx.font = '600 17px ' + fontFamily;
      ctx.fillText(title, left, y);
      y += 24;
      if (!items.length) {
        ctx.fillStyle = '#6e6e73';
        ctx.font = '14px ' + fontFamily;
        ctx.fillText('无', left, y);
        y += 26;
        return;
      }
      items.slice(0, 4).forEach((item) => {
        ctx.fillStyle = '#1d1d1f';
        ctx.font = '15px ' + fontFamily;
        ctx.fillText(item.label, left, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = color;
        ctx.font = '600 15px ' + fontFamily;
        ctx.fillText((item.delta > 0 ? '+' : '') + item.delta, W - left, y);
        ctx.textAlign = 'left';
        y += 20;
        if (item.reason) {
          ctx.fillStyle = '#6e6e73';
          ctx.font = '13px ' + fontFamily;
          for (const line of wrapText(ctx, item.reason, W - left * 2, 2)) {
            ctx.fillText(line, left, y);
            y += 18;
          }
        }
        y += 10;
      });
    };

    drawList('加分项', score.pros || [], '#248a3d', '+');
    y += 8;
    drawList('扣分项', score.cons || [], '#d70015', '−');

    // disclaimer
    y = H - 84;
    ctx.fillStyle = '#6e6e73';
    ctx.font = '12px ' + fontFamily;
    const preferenceLabel =
      { balanced: '均衡', composition: '更看重构图', light: '更看重光线', color: '更看重色彩', subject: '更看重主体' }[activePreference] || '均衡';
    ctx.fillStyle = '#6e6e73';
    ctx.font = '12px ' + fontFamily;
    ctx.fillText('评分偏好：' + preferenceLabel, left, 60);
    const note =
      '评分为主观参考建议，不是专业认证或客观总分；分数会随所选目标与偏好变化，不同模型可能给出不同结果。';
    for (const line of wrapText(ctx, note, W - left * 2, 2)) {
      ctx.fillText(line, left, y);
      y += 18;
    }

    canvas.toBlob(function (blob) {
      if (blob) window.PM.edit.downloadBlob(blob, 'photomaster-score-' + (window.PM_PHOTO?.id || 'card').slice(0, 8) + '.png');
    }, 'image/png');
  }

  const exportScoreButton = document.getElementById('export-score-card');
  if (exportScoreButton) exportScoreButton.addEventListener('click', exportScoreCard);

  // ---- copy a plain-text summary of the score for quick sharing ----
  function buildScoreText() {
    const score = window.PM_SCORE;
    if (!score) return '';
    const weights = PREFERENCE_WEIGHTS[activePreference] || PREFERENCE_WEIGHTS.balanced;
    let weighted = 0;
    let total = 0;
    (score.dimensions || []).forEach(function (dim) {
      const weight = weights[dim.key] === undefined ? Number(dim.weight) : weights[dim.key];
      weighted += Number(dim.score) * weight;
      total += weight;
    });
    const overall = total > 0 ? Math.round(weighted / total) : (score.overall ?? '—');
    const preferenceLabel =
      { balanced: '均衡', composition: '更看重构图', light: '更看重光线', color: '更看重色彩', subject: '更看重主体' }[activePreference] || '均衡';
    const lines = [];
    lines.push('【PhotoMaster · AI 参考评分】' + (window.PM_PHOTO && window.PM_PHOTO.originalName ? '' : ''));
    lines.push('总分 ' + overall + '/100（' + preferenceLabel + '，主观参考分，非专业认证）');
    if (score.dimensions && score.dimensions.length) {
      lines.push(score.dimensions.map(function (d) { return d.label + ' ' + d.score; }).join(' · '));
    }
    if ((score.pros || []).length) {
      lines.push('加分项：' + score.pros.slice(0, 3).map(function (p) { return p.label + ' +' + p.delta; }).join('；'));
    }
    if ((score.cons || []).length) {
      lines.push('扣分项：' + score.cons.slice(0, 3).map(function (c) { return c.label + ' ' + c.delta; }).join('；'));
    }
    if (window.location && window.location.href) lines.push('链接：' + window.location.href);
    return lines.join('\n');
  }

  const copyScoreButton = document.getElementById('copy-score-text');
  if (copyScoreButton)
    copyScoreButton.addEventListener('click', async function () {
      const text = buildScoreText();
      if (!text) return;
      const original = copyScoreButton.textContent;
      try {
        await navigator.clipboard.writeText(text);
        copyScoreButton.textContent = '已复制';
      } catch (err) {
        setError('复制失败，请手动选择文本');
      }
      setTimeout(function () {
        copyScoreButton.textContent = original;
      }, 2000);
    });

  // ---- dimension -> related advice jump ----
  document.querySelectorAll('[data-jump-category]').forEach(function (button) {
    button.addEventListener('click', function () {
      const category = button.getAttribute('data-jump-category');
      const findings = window.PM_FINDINGS || [];
      const target = findings.find(function (item) {
        return item.category === category;
      });
      if (!target) return;
      hidePopover();
      focusFinding(target.id);
    });
  });

  const resetButton = document.getElementById('reset-recipe');
  if (resetButton)
    resetButton.addEventListener('click', function () {
      recipe = JSON.parse(JSON.stringify(edit.DEFAULT_RECIPE));
      syncSliders();
      redraw();
    });

  const saveButton = document.getElementById('save-recipe');
  if (saveButton)
    saveButton.addEventListener('click', async function () {
      setError(null);
      saveButton.disabled = true;
      try {
        await window.PM.putJson('/api/photos/' + photo.id + '/recipe', recipe);
        savedRecipe = JSON.parse(JSON.stringify(recipe));
        syncSliders();
      } catch (err) {
        setError(err.message);
      }
      saveButton.disabled = false;
    });

  async function doExport(type) {
    try {
      const blob = await edit.exportCanvas(canvas, type);
      const ext = type === 'image/jpeg' ? 'jpg' : 'webp';
      edit.downloadBlob(blob, 'photomaster-' + photo.id.slice(0, 8) + '.' + ext);
    } catch (err) {
      setError('导出失败，请重试');
    }
  }
  // ---- export the edited image, analyse it, and compare scores side by side ----
  const reanalyzeEdited = document.getElementById('reanalyze-edited');
  if (reanalyzeEdited)
    reanalyzeEdited.addEventListener('click', async function () {
      if (!window.confirm('将对编辑后的图片重新分析一次（会消耗一次真实分析额度），继续？')) return;
      reanalyzeEdited.disabled = true;
      const label = reanalyzeEdited.textContent;
      reanalyzeEdited.textContent = '正在处理…';
      setError(null);
      try {
        const blob = await edit.exportCanvas(canvas, 'image/jpeg');
        const form = new FormData();
        form.append('file', new File([blob], 'edited-' + Date.now() + '.jpg', { type: 'image/jpeg' }));
        const uploaded = await window.PM.apiFetch('/api/photos', { method: 'POST', body: form });
        const meta = window.PM_ANALYSIS_META || {};
        await window.PM.postJson('/api/photos/' + uploaded.photo.id + '/analysis', {
          scene: meta.scene || 'auto',
          goals: meta.goals || [],
          force: false,
        });
        window.location.href = '/studio/' + uploaded.photo.id + '?compare=' + photo.id;
      } catch (err) {
        setError(err.message);
        reanalyzeEdited.disabled = false;
        reanalyzeEdited.textContent = label;
      }
    });

  const jpegButton = document.getElementById('export-jpeg');
  if (jpegButton) jpegButton.addEventListener('click', function () { doExport('image/jpeg'); });
  const webpButton = document.getElementById('export-webp');
  if (webpButton) webpButton.addEventListener('click', function () { doExport('image/webp'); });

  if (compareButton)
    compareButton.addEventListener('click', function () {
      showOriginal = !showOriginal;
      compareButton.textContent = showOriginal ? '查看修改预览' : '对比原图';
      const label = document.getElementById('edit-mode-label');
      if (label) label.textContent = showOriginal ? '原图' : '修改预览';
      canvas.classList.toggle('hidden', showOriginal);
      originalImage.classList.toggle('hidden', !showOriginal);
    });

  if (toggleButton)
    toggleButton.addEventListener('click', function () {
      editMode = !editMode;
      viewPanel.classList.toggle('hidden', editMode);
      editPanel.classList.toggle('hidden', !editMode);
      editControls.classList.toggle('hidden', !editMode);
      toggleLabel.textContent = editMode ? '查看点评' : '编辑预览';
      if (editMode) {
        syncSliders();
        redraw();
      }
    });

  const deleteButton = document.getElementById('delete-photo');
  if (deleteButton)
    deleteButton.addEventListener('click', async function () {
      if (!window.confirm('确定删除这张照片吗？相关分析记录也会一并删除。')) return;
      try {
        await window.PM.del('/api/photos/' + photo.id);
        window.location.href = '/studio';
      } catch (err) {
        setError(err.message);
      }
    });
})();