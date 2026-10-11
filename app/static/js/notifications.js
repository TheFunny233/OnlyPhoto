// Notifications page: mark all read / mark one read.
(function () {
  if (!window.PM) return;
  const errorEl = document.getElementById('notification-error');
  const badge = document.getElementById('nav-notification-badge');

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

  function markRowRead(row) {
    row.className = 'rounded-card border p-4 flex items-start gap-3 border-line bg-surface';
    const dot = row.querySelector('span[aria-hidden="true"]');
    if (dot) dot.className = 'mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-line';
  }

  const markAll = document.getElementById('mark-all-read');
  if (markAll)
    markAll.addEventListener('click', async function () {
      markAll.disabled = true;
      try {
        const res = await window.PM.postJson('/api/notifications/read', {});
        document.querySelectorAll('[data-notification-id]').forEach(markRowRead);
        updateBadge(res.unread);
      } catch (err) {
        setError(err.message);
      }
      markAll.disabled = false;
    });

  document.querySelectorAll('[data-notification-id]').forEach(function (row) {
    row.addEventListener('click', async function (event) {
      if (event.target.closest('a')) return;
      if (!row.className.includes('bg-accent/5')) return;
      try {
        const res = await window.PM.postJson(
          '/api/notifications/' + row.getAttribute('data-notification-id') + '/read',
          {},
        );
        markRowRead(row);
        updateBadge(res.unread);
      } catch (err) {
        /* ignore */
      }
    });
  });
})();