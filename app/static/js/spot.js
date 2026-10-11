// Spot detail: interactions (like/favorite/comment/report/edit/delete) + mini map.
(function () {
  const spot = window.PM_SPOT;
  if (!spot || !window.PM) return;
  const errorEl = document.getElementById('spot-error');

  function setError(message) {
    errorEl.textContent = message || '';
    errorEl.classList.toggle('hidden', !message);
  }

  window.PM.createMap({
    id: 'spot',
    container: document.getElementById('spot-map'),
    center: [spot.lat, spot.lng],
    zoom: 14,
    spots: [{ id: spot.id, title: spot.title, city: spot.city, lat: spot.lat, lng: spot.lng, precision: spot.precision }],
    onSelect: function () {},
  });

  const likeButton = document.getElementById('like-button');
  if (likeButton) {
    likeButton.addEventListener('click', async function () {
      const active = likeButton.getAttribute('data-active') === '1';
      const label = likeButton.querySelector('[data-like-label]');
      const count = spot.likeCount;
      likeButton.setAttribute('data-active', active ? '0' : '1');
      label.textContent = (active ? '点赞 ' : '已赞 ') + (count + (active ? -1 : 1));
      try {
        const res = await window.PM.postJson('/api/spots/' + spot.id + '/like', {});
        likeButton.setAttribute('data-active', res.liked ? '1' : '0');
        label.textContent = (res.liked ? '已赞 ' : '点赞 ') + res.count;
        spot.likeCount = res.count;
      } catch (err) {
        likeButton.setAttribute('data-active', active ? '1' : '0');
        label.textContent = (active ? '已赞 ' : '点赞 ') + count;
        setError(err.status === 401 ? '请先登录' : '点赞失败，请重试');
        if (err.status === 401) window.location.href = '/login';
      }
    });
  }

  const favoriteButton = document.getElementById('favorite-button');
  if (favoriteButton) {
    favoriteButton.addEventListener('click', async function () {
      const active = favoriteButton.getAttribute('data-active') === '1';
      const label = favoriteButton.querySelector('[data-fav-label]');
      const count = spot.favoriteCount;
      favoriteButton.setAttribute('data-active', active ? '0' : '1');
      label.textContent = (active ? '收藏 ' : '已收藏 ') + (count + (active ? -1 : 1));
      try {
        const res = await window.PM.postJson('/api/spots/' + spot.id + '/favorite', {});
        favoriteButton.setAttribute('data-active', res.favorited ? '1' : '0');
        label.textContent = (res.favorited ? '已收藏 ' : '收藏 ') + res.count;
        spot.favoriteCount = res.count;
      } catch (err) {
        favoriteButton.setAttribute('data-active', active ? '1' : '0');
        label.textContent = (active ? '已收藏 ' : '收藏 ') + count;
        setError(err.status === 401 ? '请先登录' : '收藏失败，请重试');
        if (err.status === 401) window.location.href = '/login';
      }
    });
  }

  const commentForm = document.getElementById('comment-form');
  if (commentForm) {
    commentForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const input = document.getElementById('comment-input');
      const submit = document.getElementById('comment-submit');
      const body = input.value.trim();
      if (!body) return;
      submit.disabled = true;
      try {
        const res = await window.PM.postJson('/api/spots/' + spot.id + '/comments', { body: body });
        const empty = document.querySelector('[data-empty-comments]');
        if (empty) empty.remove();
        const li = document.createElement('li');
        li.setAttribute('data-comment-id', res.comment.id);
        li.className = 'rounded-card border border-line bg-surface p-4';
        li.innerHTML =
          '<div class="flex items-center justify-between"><span class="text-sm font-medium text-ink">' +
          window.PM.escapeHtml(res.comment.nickname) +
          '</span><span class="text-xs text-muted">' +
          window.PM.formatDate(res.comment.createdAt) +
          '</span></div><p class="mt-2 text-body whitespace-pre-wrap break-words">' +
          window.PM.escapeHtml(res.comment.body) +
          '</p><div class="mt-2 flex gap-3 text-xs"><button type="button" class="text-danger hover:underline" data-delete-comment="' +
          res.comment.id +
          '">删除</button><button type="button" class="text-muted hover:text-ink" data-report-comment="' +
          res.comment.id +
          '">举报</button></div>';
        const list = document.getElementById('comment-list');
        list.insertBefore(li, list.firstChild);
        bindCommentActions(li);
        input.value = '';
        const counter = document.getElementById('comment-count');
        counter.textContent = String(Number(counter.textContent) + 1);
      } catch (err) {
        setError(err.message);
      }
      submit.disabled = false;
    });
  }

  async function report(targetType, targetId) {
    const reason = window.prompt('请简要说明举报原因');
    if (!reason) return;
    try {
      await window.PM.postJson('/api/reports', { targetType: targetType, targetId: targetId, reason: reason });
      window.alert('已收到举报，我们会进行核查。');
    } catch (err) {
      setError(err.message);
    }
  }

  function bindCommentActions(scope) {
    scope.querySelectorAll('[data-delete-comment]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          await window.PM.del('/api/comments/' + button.getAttribute('data-delete-comment'));
          const li = button.closest('li');
          li.remove();
          const counter = document.getElementById('comment-count');
          counter.textContent = String(Math.max(0, Number(counter.textContent) - 1));
        } catch (err) {
          setError(err.message);
        }
      });
    });
    scope.querySelectorAll('[data-report-comment]').forEach(function (button) {
      button.addEventListener('click', function () {
        report('comment', button.getAttribute('data-report-comment'));
      });
    });
  }
  bindCommentActions(document);

  const reportSpot = document.getElementById('report-spot');
  if (reportSpot)
    reportSpot.addEventListener('click', function () {
      report('spot', spot.id);
    });

  const toggleEditSpot = document.getElementById('toggle-edit-spot');
  if (toggleEditSpot)
    toggleEditSpot.addEventListener('click', function () {
      document.getElementById('edit-form').classList.toggle('hidden');
    });
  const cancelEdit = document.getElementById('cancel-edit');
  if (cancelEdit)
    cancelEdit.addEventListener('click', function () {
      document.getElementById('edit-form').classList.add('hidden');
    });
  const saveSpot = document.getElementById('save-spot');
  if (saveSpot)
    saveSpot.addEventListener('click', async function () {
      setError(null);
      saveSpot.disabled = true;
      try {
        await window.PM.patchJson('/api/spots/' + spot.id, {
          title: document.getElementById('edit-title').value,
          city: document.getElementById('edit-city').value,
          area: document.getElementById('edit-area').value,
          precision: document.getElementById('edit-precision').value,
          howToStand: document.getElementById('edit-how').value,
          direction: document.getElementById('edit-direction').value,
          bestLight: document.getElementById('edit-light').value,
          lightSource: document.getElementById('edit-lightsource').value,
          gear: document.getElementById('edit-gear').value,
          safety: document.getElementById('edit-safety').value,
        });
        window.location.reload();
      } catch (err) {
        setError(err.message);
        saveSpot.disabled = false;
      }
    });

  const deleteSpot = document.getElementById('delete-spot');
  if (deleteSpot)
    deleteSpot.addEventListener('click', async function () {
      if (!window.confirm('确定删除这个机位吗？此操作不可恢复。')) return;
      try {
        await window.PM.del('/api/spots/' + spot.id);
        window.location.href = '/explore';
      } catch (err) {
        setError(err.message);
      }
    });
})();