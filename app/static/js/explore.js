// Explore: filters (city/subject/keyword/author/sort/near), load-more, list <-> map linkage.
(function () {
  if (!document.getElementById('explore-map')) return;

  const filters = window.PM_FILTERS || {};
  const state = {
    spots: Array.isArray(window.PM_SPOTS) ? window.PM_SPOTS.slice() : [],
    selectedId: null,
    offset: window.PM_SPOTS ? window.PM_SPOTS.length : 0,
    hasMore: !!window.PM_HAS_MORE,
    near: null,
    mapApi: null,
  };

  const listWrap = document.getElementById('spot-list-wrap');
  const detail = document.getElementById('map-detail');
  const loadMoreWrap = document.getElementById('load-more-wrap');
  const totalLabel = document.getElementById('result-total');

  function rowHtml(spot) {
    const subjects = (spot.subjects || []).join(' · ') || spot.description || '';
    const distance = typeof spot.distanceKm === 'number' ? ' · ' + spot.distanceKm + ' km' : '';
    return (
      '<li data-spot-id="' + spot.id + '">' +
      '<button type="button" data-select="' + spot.id + '" class="w-full text-left rounded-card border p-4 transition-colors duration-200 ' +
      (state.selectedId === spot.id ? 'border-accent bg-accent/5' : 'border-line bg-surface hover:bg-page') +
      '">' +
      '<div class="flex items-center gap-2 text-xs text-muted"><span>' + window.PM.escapeHtml(spot.city || '未标注城市') + '</span>' +
      '<span>· ' + (spot.precision === 'approximate' ? '大致位置' : '精确位置') + '</span>' +
      (spot.isDemo ? '<span>· 演示数据</span>' : '') + '<span>' + distance + '</span></div>' +
      '<p class="mt-1 font-medium text-ink">' + window.PM.escapeHtml(spot.title) + '</p>' +
      '<p class="text-sm text-body line-clamp-2 mt-0.5">' + window.PM.escapeHtml(subjects) + '</p>' +
      '<div class="mt-2 flex items-center gap-3 text-xs text-muted">' +
      '<span>点赞 ' + spot.likeCount + '</span>' +
      '<span>收藏 ' + spot.favoriteCount + '</span>' +
      '<span>评论 ' + spot.commentCount + '</span>' +
      '<span>' + spot.viewCount + ' 次浏览</span>' +
      '<span class="ml-auto"><a href="/spots/' + spot.id + '" data-stop="1" class="text-accent hover:underline">详情 →</a></span>' +
      '</div></button></li>'
    );
  }

  function renderList() {
    if (state.spots.length === 0) {
      listWrap.innerHTML =
        '<div class="text-center py-16 px-6"><h3 class="text-xl font-semibold tracking-tight text-ink">没有符合条件的机位</h3>' +
        '<p class="mt-2 text-body max-w-md mx-auto">可以调整筛选条件，或发布你自己的第一个机位。</p>' +
        '<div class="mt-6"><a href="/publish" class="text-accent hover:underline">发布机位 →</a></div></div>';
    } else {
      listWrap.innerHTML =
        '<ul id="spot-list" data-testid="spot-list" class="flex flex-col gap-3">' + state.spots.map(rowHtml).join('') + '</ul>';
    }
    listWrap.querySelectorAll('[data-select]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        if (event.target.closest('[data-stop]')) return;
        select(button.getAttribute('data-select'));
      });
    });
    if (loadMoreWrap) loadMoreWrap.classList.toggle('hidden', !state.hasMore);
  }

  function render() {
    renderList();
    if (state.mapApi) state.mapApi.render(state.spots, state.selectedId);
  }

  function select(id) {
    state.selectedId = id;
    const spot = state.spots.find(function (s) {
      return s.id === id;
    });
    if (spot && state.mapApi) state.mapApi.flyTo(spot);
    render();
    if (spot && detail) {
      detail.classList.remove('hidden');
      detail.innerHTML =
        '<div class="rounded-card border border-line bg-surface p-5 relative">' +
        '<button type="button" id="close-detail" class="absolute right-4 top-4 text-muted hover:text-ink" aria-label="关闭详情">×</button>' +
        '<p class="text-xs text-muted">' + window.PM.escapeHtml(spot.city || '') + '</p>' +
        '<h2 class="text-lg font-semibold tracking-tight text-ink">' + window.PM.escapeHtml(spot.title) + '</h2>' +
        '<p class="mt-1 text-sm text-body line-clamp-3">' + window.PM.escapeHtml(spot.description || '') + '</p>' +
        '<a href="/spots/' + spot.id + '" class="mt-3 inline-block text-accent hover:underline">打开发布详情 →</a></div>';
      document.getElementById('close-detail').addEventListener('click', function () {
        detail.classList.add('hidden');
      });
    }
  }

  function buildParams() {
    const params = new URLSearchParams();
    const city = document.getElementById('filter-city').value;
    const subject = document.getElementById('filter-subject').value;
    const q = document.getElementById('filter-q').value.trim();
    const author = document.getElementById('filter-author').value.trim();
    const sort = document.getElementById('filter-sort').value;
    const favorites = document.getElementById('filter-favorites').checked;
    if (city) params.set('city', city);
    if (subject) params.set('subject', subject);
    if (q) params.set('q', q);
    if (author) params.set('author', author);
    if (sort && sort !== 'latest') params.set('sort', sort);
    if (favorites) params.set('favorites', '1');
    if (state.near) {
      params.set('near', '1');
      params.set('lat', String(state.near.lat));
      params.set('lng', String(state.near.lng));
    }
    return params;
  }

  async function load(reset) {
    const params = buildParams();
    params.set('limit', '24');
    params.set('offset', String(reset ? 0 : state.offset));
    try {
      const data = await window.PM.apiFetch('/api/spots?' + params.toString());
      const incoming = data.spots || [];
      state.spots = reset ? incoming : state.spots.concat(incoming);
      state.offset = state.spots.length;
      state.hasMore = !!data.hasMore;
      if (totalLabel) totalLabel.textContent = String(data.total);
      if (reset) {
        state.selectedId = null;
        if (detail) detail.classList.add('hidden');
      }
      render();
    } catch (err) {
      /* keep previous list on failure */
    }
  }

  window.PM.createMap({
    id: 'explore',
    container: document.getElementById('explore-map'),
    onSelect: select,
    onReady: function (api) {
      state.mapApi = api;
      render();
      const pending = new URLSearchParams(window.location.search).get('spot');
      if (pending) select(pending);
    },
  });

  ['filter-city', 'filter-subject', 'filter-sort', 'filter-favorites'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', function () {
      load(true);
    });
  });
  let timer = null;
  ['filter-q', 'filter-author'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        load(true);
      }, 300);
    });
  });

  const loadMore = document.getElementById('load-more');
  if (loadMore)
    loadMore.addEventListener('click', function () {
      loadMore.disabled = true;
      loadMore.textContent = '加载中…';
      load(false).finally(function () {
        loadMore.disabled = false;
        loadMore.textContent = '加载更多';
      });
    });

  const nearButton = document.getElementById('filter-near');
  const nearNote = document.getElementById('near-note');
  if (nearButton)
    nearButton.addEventListener('click', function () {
      const message = document.getElementById('geo-message');
      message.classList.add('hidden');
      if (!('geolocation' in navigator)) {
        message.textContent = '当前浏览器不支持定位，可手动在地图上点选或浏览列表。';
        message.classList.remove('hidden');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (position) {
          state.near = { lat: position.coords.latitude, lng: position.coords.longitude };
          nearButton.classList.add('ring-2', 'ring-accent');
          if (nearNote) nearNote.classList.remove('hidden');
          if (state.mapApi) state.mapApi.recenter(state.near.lat, state.near.lng);
          load(true);
        },
        function () {
          message.textContent = '定位被拒绝或不可用，仍可浏览列表与手动选择机位。';
          message.classList.remove('hidden');
        },
        { timeout: 8000 },
      );
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
        if (state.mapApi) state.mapApi.recenter(position.coords.latitude, position.coords.longitude);
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
    viewMap.className =
      mode === 'map'
        ? 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm min-h-[40px] bg-accent text-white'
        : 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm min-h-[40px] bg-surface text-ink border border-line';
    viewList.className =
      mode === 'list'
        ? 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm min-h-[40px] bg-accent text-white'
        : 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm min-h-[40px] bg-surface text-ink border border-line';
  }
  viewMap.addEventListener('click', function () {
    setView('map');
  });
  viewList.addEventListener('click', function () {
    setView('list');
  });
  if (window.innerWidth < 1024) setView('list');

  void filters;
})();