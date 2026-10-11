// Notifications page: type filter, mark read, clear read, load more.
(function () {
  if (!window.PM) return;
  const errorEl = document.getElementById('notification-error');
  const badge = document.getElementById('nav-notification-badge');
  const list = document.getElementById('notification-list');
  const moreWrap = document.getElementById('notification-more-wrap');
  const moreButton = document.getElementById('notification-more');
  const filters = document.getElementById('notification-filters');

  const state = { type: '', offset: 0, limit: 30, hasMore: false };

  function setError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.classList.toggle('hidden', !message);
  }

  function updateBadge(unread) {
    if (!badge) return;
    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function itemHtml(item) {
    const unread = !item.read;
    return (
      '<li data-notification-id="' + item.id + '" data-read="' + (item.read ? '1' : '0') + '" class="rounded-card border p-4 flex items-start gap-3 ' +
      (unread ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface') +
      '">' +
      '<span aria-hidden="true" class="mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full ' + (unread ? 'bg-accent' : 'bg-line') + '"></span>' +
      '<div class="min-w-0"><p class="text-sm text-ink">' +
      '<a href="/u/' + item.actorId + '" class="font-medium hover:text-accent">' + window.PM.escapeHtml(item.actorName) + '</a> ' +
      window.PM.escapeHtml(item.label) +
      (item.spotId ? ' · <a href="/spots/' + item.spotId + '" class="text-accent hover:underline">查看机位</a>' : '') +
      '</p><p class="mt-1 text-xs text-muted">' + window.PM.formatDate(item.createdAt) + '</p></div></li>'
    );
  }

  function render(items, append) {
    if (!append) list.innerHTML = '';
    if (items.length === 0 && !append) {
      list.innerHTML = '<li class="text-sm text-muted">没有符合条件的通知。</li>';
    } else {
      items.forEach(function (item) {
        list.insertAdjacentHTML('beforeend', itemHtml(item));
      });
    }
    moreWrap.classList.toggle('hidden', !state.hasMore);
    bindRows();
  }

  function bindRows() {
    list.querySelectorAll('[data-notification-id]').forEach(function (row) {
      if (row.dataset.bound) return;
      row.dataset.bound = '1';
      row.addEventListener('click', async function (event) {
        if (event.target.closest('a') || row.getAttribute('data-read') === '1') return;
        try {
          const res = await window.PM.postJson(
            '/api/notifications/' + row.getAttribute('data-notification-id') + '/read',
            {},
          );
          row.setAttribute('data-read', '1');
          row.className = 'rounded-card border p-4 flex items-start gap-3 border-line bg-surface';
          const dot = row.querySelector('span[aria-hidden="true"]');
          if (dot) dot.className = 'mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-line';
          updateBadge(res.unread);
        } catch (err) {
          /* ignore */
        }
      });
    });
  }

  async function load(append) {
    setError(null);
    const params = new URLSearchParams();
    if (state.type) params.set('type', state.type);
    params.set('offset', String(append ? state.offset : 0));
    params.set('limit', String(state.limit));
    try {
      const data = await window.PM.apiFetch('/api/notifications?' + params.toString());
      const items = data.notifications || [];
      state.offset = (append ? state.offset : 0) + items.length;
      state.hasMore = !!data.hasMore;
      updateBadge(data.unread);
      render(items, append);
    } catch (err) {
      setError(err.message);
    }
  }

  if (filters) {
    filters.querySelectorAll('[data-type]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.type = button.getAttribute('data-type');
        state.offset = 0;
        filters.querySelectorAll('[data-type]').forEach(function (item) {
          const active = item.getAttribute('data-type') === state.type;
          item.className =
            'inline-flex items-center rounded-full px-3 py-1.5 text-sm border transition-colors duration-200 ' +
            (active ? 'bg-accent text-white border-accent' : 'bg-surface text-body border-line hover:bg-page');
        });
        load(false);
      });
    });
  }

  if (moreButton)
    moreButton.addEventListener('click', function () {
      moreButton.disabled = true;
      load(true).finally(function () {
        moreButton.disabled = false;
      });
    });

  const markAll = document.getElementById('mark-all-read');
  if (markAll)
    markAll.addEventListener('click', async function () {
      try {
        const res = await window.PM.postJson('/api/notifications/read', {});
        list.querySelectorAll('[data-notification-id]').forEach(function (row) {
          row.setAttribute('data-read', '1');
          row.className = 'rounded-card border p-4 flex items-start gap-3 border-line bg-surface';
          const dot = row.querySelector('span[aria-hidden="true"]');
          if (dot) dot.className = 'mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-line';
        });
        updateBadge(res.unread);
      } catch (err) {
        setError(err.message);
      }
    });

  const clearRead = document.getElementById('clear-read');
  if (clearRead)
    clearRead.addEventListener('click', async function () {
      if (!window.confirm('清空所有已读通知？')) return;
      try {
        const res = await window.PM.postJson('/api/notifications/clear-read', {});
        updateBadge(res.unread);
        await load(false);
      } catch (err) {
        setError(err.message);
      }
    });

  // The server rendered the first page; wire up the existing rows.
  bindRows();
})();