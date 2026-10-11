// Explore page: list <-> map linkage, filters and geolocation.
(function () {
  if (!document.getElementById('explore-map')) return;

  let spots = Array.isArray(window.PM_SPOTS) ? window.PM_SPOTS.slice() : [];
  let selectedId = null;
  let mapApi = null;

  const listWrap = document.getElementById('spot-list-wrap');
  const detail = document.getElementById('map-detail');

  function rowHtml(spot) {
    const subjects = (spot.subjects || []).join(' · ') || spot.description || '';
    return (
      '<li data-spot-id="' + spot.id + '">' +
      '<button type="button" data-select="' + spot.id + '" class="w-full text-left rounded-card border p-4 transition-colors duration-200 ' +
      (selectedId === spot.id ? 'border-accent bg-accent/5' : 'border-line bg-surface hover:bg-page') +
      '">' +
      '<div class="flex items-center gap-2 text-xs text-muted"><span>' + window.PM.escapeHtml(spot.city || '未标注城市') + '</span>' +
      '<span>· ' + (spot.precision === 'approximate' ? '大致位置' : '精确位置') + '</span>' +
      (spot.isDemo ? '<span>· 演示数据</span>' : '') + '</div>' +
      '<p class="mt-1 font-medium text-ink">' + window.PM.escapeHtml(spot.title) + '</p>' +
      '<p class="text-sm text-body line-clamp-2 mt-0.5">' + window.PM.escapeHtml(subjects) + '</p>' +
      '<a href="/spots/' + spot.id + '" data-stop="1" class="mt-2 inline-block text-sm text-accent hover:underline">查看详情 →</a>' +
      '</button></li>'
    );
  }

  function render() {
    if (spots.length === 0) {
      listWrap.innerHTML =
        '<div class="text-center py-16 px-6"><h3 class="text-xl font-semibold tracking-tight text-ink">没有符合条件的机位</h3>' +
        '<p class="mt-2 text-body max-w-md mx-auto">可以调整筛选条件，或发布你自己的第一个机位。</p>' +
        '<div class="mt-6"><a href="/publish" class="text-accent hover:underline">发布机位 →</a></div></div>';
    } else {
      listWrap.innerHTML = '<ul id="spot-list" data-testid="spot-list" class="flex flex-col gap-3">' + spots.map(rowHtml).join('') + '</ul>';
    }
    if (mapApi) mapApi.render(spots, selectedId);
    listWrap.querySelectorAll('[data-select]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        if (event.target.closest('[data-stop]')) return;
        select(button.getAttribute('data-select'));
      });
    });
  }

  function select(id) {
    selectedId = id;
    const spot = spots.find(function (s) {
      return s.id === id;
    });
    if (spot && mapApi) mapApi.flyTo(spot);
    render();
    if (spot && detail) {
      detail.classList.remove('hidden');
      detail.innerHTML =
        '<div class="rounded-card border border-line bg-surface p-5 relative">' +
        '<button type="button" id="close-detail" class="absolute right-4 top-4 text-muted hover:text-ink" aria-label="关闭详情">&times;</button>' +
        '<p class="text-xs text-muted">' + window.PM.escapeHtml(spot.city || '') + '</p>' +
        '<h2 class="text-lg font-semibold tracking-tight text-ink">' + window.PM.escapeHtml(spot.title) + '</h2>' +
        '<p class="mt-1 text-sm text-body line-clamp-3">' + window.PM.escapeHtml(spot.description || '') + '</p>' +
        '<a href="/spots/' + spot.id + '" class="mt-3 inline-block text-accent hover:underline">打开发布详情 →</a></div>';
      document.getElementById('close-detail').addEventListener('click', function () {
        detail.classList.add('hidden');
      });
    }
  }

  async function load() {
    const params = new URLSearchParams();
    const city = document.getElementById('filter-city').value;
    const subject = document.getElementById('filter-subject').value;
    const q = document.getElementById('filter-q').value;
    const favorites = document.getElementById('filter-favorites').checked;
    if (city) params.set('city', city);
    if (subject) params.set('subject', subject);
    if (q) params.set('q', q);
    if (favorites) params.set('favorites', '1');
    try {
      const data = await window.PM.apiFetch('/api/spots?' + params.toString());
      spots = data.spots || [];
      selectedId = null;
      if (detail) detail.classList.add('hidden');
      render();
    } catch (err) {
      /* keep the previous list on failure */
    }
  }

  window.PM.createMap({
    id: 'explore',
    container: document.getElementById('explore-map'),
    onSelect: select,
    onReady: function (api) {
      mapApi = api;
      render();
      const pending = new URLSearchParams(window.location.search).get('spot');
      if (pending) select(pending);
    },
  });

  ['filter-city', 'filter-subject', 'filter-favorites'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', load);
  });
  let timer = null;
  document.getElementById('filter-q').addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(load, 300);
  });

  document.getElementById('geo-button').addEventListener('click', function () {
    const message = document.getElementById('geo-message');
    message.classList.add('hidden');
    if (!('geolocation' in navigator)) {
      message.textContent = '当前浏览器不支持定位，可手动在地图上点选或浏览列表。';
      message.classList.remove('hidden');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (position) {
        if (mapApi) mapApi.recenter(position.coords.latitude, position.coords.longitude);
      },
      function () {
        message.textContent = '定位被拒绝或不可用，仍可浏览列表与手动选择机位。';
        message.classList.remove('hidden');
      },
      { timeout: 8000 },
    );
  });

  const viewMap = document.getElementById('view-map');
  const viewList = document.getElementById('view-list');
  function setView(mode) {
    document.getElementById('panel-list').classList.toggle('hidden', mode === 'map');
    document.getElementById('panel-map').classList.toggle('hidden', mode === 'list');
    viewMap.className = mode === 'map' ? 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm min-h-[40px] bg-accent text-white' : 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm min-h-[40px] bg-surface text-ink border border-line';
    viewList.className = mode === 'list' ? 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm min-h-[40px] bg-accent text-white' : 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm min-h-[40px] bg-surface text-ink border border-line';
  }
  viewMap.addEventListener('click', function () {
    setView('map');
  });
  viewList.addEventListener('click', function () {
    setView('list');
  });
  if (window.innerWidth < 1024) setView('list');
})();