// Spot detail: interactions (like/favorite/follow/comment/reply/comment-like/report/edit/delete) + mini map.
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

  // ---------- like / favorite ----------
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

  const followButton = document.getElementById('follow-button');
  if (followButton) {
    followButton.addEventListener('click', async function () {
      const active = followButton.getAttribute('data-active') === '1';
      followButton.setAttribute('data-active', active ? '0' : '1');
      followButton.textContent = active ? '关注' : '已关注';
      try {
        const res = await window.PM.postJson('/api/users/' + spot.ownerId + '/follow', {});
        followButton.setAttribute('data-active', res.following ? '1' : '0');
        followButton.textContent = res.following ? '已关注' : '关注';
      } catch (err) {
        followButton.setAttribute('data-active', active ? '1' : '0');
        followButton.textContent = active ? '已关注' : '关注';
        if (err.status === 401) window.location.href = '/login';
        else setError(err.message);
      }
    });
  }

  // ---------- views ----------
  window.PM.postJson('/api/spots/' + spot.id + '/view', {}).catch(function () {});

  // ---------- comments ----------
  function commentHtml(comment, isReply) {
    const wrapperClass = isReply
      ? 'mt-3 rounded-card border border-line bg-page p-3'
      : 'rounded-card border border-line bg-surface p-4';
    return (
      '<li data-comment-id="' + comment.id + '" class="' + wrapperClass + '">' +
      '<div class="flex items-center justify-between"><span class="text-sm font-medium text-ink">' +
      window.PM.escapeHtml(comment.nickname) +
      '</span><span class="text-xs text-muted">' + window.PM.formatDate(comment.createdAt) + '</span></div>' +
      '<p class="mt-2 text-body whitespace-pre-wrap break-words">' + window.PM.escapeHtml(comment.body) + '</p>' +
      '<div class="mt-2 flex items-center gap-3 text-xs">' +
      '<button type="button" data-like-comment="' + comment.id + '" data-active="0" class="text-muted hover:text-ink">♥ <span data-like-count>0</span></button>' +
      '<button type="button" data-reply-comment="' + comment.id + '" class="text-accent hover:underline">回复</button>' +
      '<button type="button" class="text-danger hover:underline" data-delete-comment="' + comment.id + '">删除</button>' +
      '<button type="button" class="text-muted hover:text-ink" data-report-comment="' + comment.id + '">举报</button>' +
      '</div>' +
      '<div data-reply-form="' + comment.id + '" class="mt-3 hidden">' +
      '<textarea rows="2" data-reply-input="' + comment.id + '" class="w-full bg-page rounded-control px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"></textarea>' +
      '<div class="mt-2 flex gap-2"><button type="button" data-reply-submit="' + comment.id + '" class="inline-flex items-center rounded-full px-4 py-1.5 text-sm bg-accent text-white">回复</button>' +
      '<button type="button" data-reply-cancel="' + comment.id + '" class="inline-flex items-center rounded-full px-4 py-1.5 text-sm bg-surface text-ink border border-line">取消</button></div></div>' +
      '<ul class="mt-1 flex flex-col" data-replies="' + comment.id + '"></ul>' +
      '</li>'
    );
  }

  function bindActions(scope) {
    scope.querySelectorAll('[data-like-comment]').forEach(function (button) {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', async function () {
        const id = button.getAttribute('data-like-comment');
        try {
          const res = await window.PM.postJson('/api/comments/' + id + '/like', {});
          button.setAttribute('data-active', res.liked ? '1' : '0');
          button.className = res.liked ? 'text-accent font-medium' : 'text-muted hover:text-ink';
          const countEl = button.querySelector('[data-like-count]');
          if (countEl) countEl.textContent = res.count;
        } catch (err) {
          if (err.status === 401) window.location.href = '/login';
          else setError(err.message);
        }
      });
    });

    scope.querySelectorAll('[data-reply-comment]').forEach(function (button) {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', function () {
        const id = button.getAttribute('data-reply-comment');
        const form = document.querySelector('[data-reply-form="' + id + '"]');
        if (form) form.classList.toggle('hidden');
      });
    });

    scope.querySelectorAll('[data-reply-cancel]').forEach(function (button) {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', function () {
        const id = button.getAttribute('data-reply-cancel');
        const form = document.querySelector('[data-reply-form="' + id + '"]');
        if (form) form.classList.add('hidden');
      });
    });

    scope.querySelectorAll('[data-reply-submit]').forEach(function (button) {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', async function () {
        const id = button.getAttribute('data-reply-submit');
        const input = document.querySelector('[data-reply-input="' + id + '"]');
        const body = input.value.trim();
        if (!body) return;
        button.disabled = true;
        try {
          const res = await window.PM.postJson('/api/spots/' + spot.id + '/comments', { body: body, parentId: id });
          const list = document.querySelector('[data-replies="' + id + '"]');
          if (list) {
            list.insertAdjacentHTML('beforeend', commentHtml(res.comment, true));
            bindActions(list);
          }
          input.value = '';
          const form = document.querySelector('[data-reply-form="' + id + '"]');
          if (form) form.classList.add('hidden');
          const counter = document.getElementById('comment-count');
          counter.textContent = String(Number(counter.textContent) + 1);
        } catch (err) {
          setError(err.message);
        }
        button.disabled = false;
      });
    });

    scope.querySelectorAll('[data-delete-comment]').forEach(function (button) {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
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
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', function () {
        report('comment', button.getAttribute('data-report-comment'));
      });
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
        const list = document.getElementById('comment-list');
        list.insertAdjacentHTML('afterbegin', commentHtml(res.comment, false));
        bindActions(list);
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

  bindActions(document);

  const shareButton = document.getElementById('share-spot');
  if (shareButton)
    shareButton.addEventListener('click', async function () {
      const url = window.location.origin + '/spots/' + spot.id;
      try {
        if (navigator.share) {
          await navigator.share({ title: spot.title, url: url });
        } else {
          await navigator.clipboard.writeText(url);
          shareButton.textContent = '已复制链接';
          setTimeout(function () {
            shareButton.textContent = '分享';
          }, 2000);
        }
      } catch (err) {
        /* user cancelled or clipboard unavailable */
      }
    });

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