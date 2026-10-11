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