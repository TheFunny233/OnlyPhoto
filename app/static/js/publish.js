// Publish a spot: stepped form with map picking.
(function () {
  if (!document.getElementById('publish-map')) return;
  const errorEl = document.getElementById('publish-error');
  const state = {
    step: 0,
    lat: null,
    lng: null,
    precision: 'approximate',
    photoId: window.PM_PRESELECT || null,
    subjects: [],
    mapApi: null,
  };

  function setError(message) {
    errorEl.textContent = message || '';
    errorEl.classList.toggle('hidden', !message);
  }

  window.PM.createMap({
    id: 'publish',
    container: document.getElementById('publish-map'),
    zoom: 12,
    spots: [],
    onSelect: function () {},
    pick: {
      onPick: function (lat, lng) {
        state.lat = lat;
        state.lng = lng;
        document.getElementById('coord-label').textContent = lat.toFixed(4) + ', ' + lng.toFixed(4);
        if (state.mapApi) state.mapApi.setPick({ lat, lng });
      },
    },
    onReady: function (api) {
      state.mapApi = api;
    },
  });

  document.querySelectorAll('[data-precision]').forEach(function (button) {
    button.addEventListener('click', function () {
      state.precision = button.getAttribute('data-precision');
      document.querySelectorAll('[data-precision]').forEach(function (b) {
        const active = b.getAttribute('data-precision') === state.precision;
        b.className =
          'px-3 py-1.5 rounded-full text-sm border ' +
          (active ? 'bg-accent text-white border-accent' : 'bg-surface border-line text-body');
      });
      document.getElementById('precision-warning').classList.toggle('hidden', state.precision !== 'exact');
    });
  });

  function selectPhoto(id) {
    state.photoId = id === 'none' ? null : id;
    document.querySelectorAll('[data-photo]').forEach(function (b) {
      const value = b.getAttribute('data-photo');
      const active = (state.photoId && value === state.photoId) || (!state.photoId && value === 'none');
      b.classList.toggle('border-accent', !!active);
      b.classList.toggle('ring-2', !!active && value !== 'none');
      b.classList.toggle('ring-accent/40', !!active && value !== 'none');
    });
  }
  document.querySelectorAll('[data-photo]').forEach(function (button) {
    button.addEventListener('click', function () {
      selectPhoto(button.getAttribute('data-photo'));
    });
  });
  if (state.photoId) selectPhoto(state.photoId);

  document.querySelectorAll('[data-subject]').forEach(function (button) {
    button.addEventListener('click', function () {
      const value = button.getAttribute('data-subject');
      const index = state.subjects.indexOf(value);
      if (index >= 0) state.subjects.splice(index, 1);
      else state.subjects.push(value);
      const active = state.subjects.indexOf(value) >= 0;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.className =
        'px-3 py-1.5 rounded-full text-sm border ' +
        (active ? 'bg-accent text-white border-accent' : 'bg-surface border-line text-body');
    });
  });

  function showStep(step) {
    state.step = step;
    document.querySelectorAll('[data-step-panel]').forEach(function (panel) {
      panel.classList.toggle('hidden', Number(panel.getAttribute('data-step-panel')) !== step);
    });
    document.querySelectorAll('[data-step-badge]').forEach(function (badge) {
      const index = Number(badge.getAttribute('data-step-badge'));
      badge.className =
        'inline-flex items-center justify-center h-6 w-6 rounded-full text-xs ' +
        (index <= step ? 'bg-accent text-white' : 'bg-page text-muted');
    });
    document.querySelectorAll('[data-step-label]').forEach(function (label) {
      const index = Number(label.getAttribute('data-step-label'));
      label.className = index === step ? 'text-ink font-medium' : 'text-muted';
    });
    document.getElementById('prev-step').disabled = step === 0;
    document.getElementById('next-step').classList.toggle('hidden', step === 3);
    document.getElementById('publish-submit').classList.toggle('hidden', step !== 3);
    if (step === 3) renderReview();
  }

  function value(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function renderReview() {
    document.getElementById('r-city').textContent = value('f-city') || '未填写城市';
    document.getElementById('r-precision').textContent = state.precision === 'approximate' ? '· 大致位置' : '· 精确位置';
    document.getElementById('r-title').textContent = value('f-title') || '（未填写标题）';
    document.getElementById('r-subjects').innerHTML = state.subjects
      .map(function (s) {
        return '<span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-page text-body border border-line">' + window.PM.escapeHtml(s) + '</span>';
      })
      .join('');
    document.getElementById('r-how').textContent = value('f-how') || '（未填写站位说明）';
    document.getElementById('r-coord').textContent =
      '坐标：' + (state.lat == null ? '未选择' : state.lat.toFixed(4) + ', ' + state.lng.toFixed(4));
    document.getElementById('r-photo').textContent = state.photoId ? '样张：附带 1 张公开派生图' : '样张：不附带照片';
  }

  function next() {
    setError(null);
    if (state.step === 0) {
      if (!value('f-city')) return setError('请填写城市');
      if (state.lat == null) return setError('请在地图上点选一个位置（至少大致位置）');
    }
    if (state.step === 2 && !value('f-title')) return setError('请填写机位标题');
    showStep(Math.min(state.step + 1, 3));
  }

  document.getElementById('next-step').addEventListener('click', next);
  document.getElementById('prev-step').addEventListener('click', function () {
    showStep(Math.max(0, state.step - 1));
  });

  document.getElementById('publish-submit').addEventListener('click', async function () {
    if (!document.getElementById('publish-confirm').checked) {
      setError('请确认公开范围');
      return;
    }
    const button = document.getElementById('publish-submit');
    button.disabled = true;
    setError(null);
    try {
      const res = await window.PM.postJson('/api/spots', {
        title: value('f-title'),
        city: value('f-city'),
        area: value('f-area'),
        lat: state.lat,
        lng: state.lng,
        coordSystem: 'WGS84',
        precision: state.precision,
        subjects: state.subjects,
        description: value('f-description'),
        howToStand: value('f-how'),
        direction: value('f-direction'),
        bestLight: value('f-light'),
        lightSource: value('f-lightsource'),
        gear: value('f-gear'),
        safety: value('f-safety'),
        status: 'published',
        photoId: state.photoId,
      });
      window.location.href = '/spots/' + res.spot.id;
    } catch (err) {
      setError(err.message);
      button.disabled = false;
    }
  });

  showStep(0);
})();