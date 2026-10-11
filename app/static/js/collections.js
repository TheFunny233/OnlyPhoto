// Collections: create/delete on the list page; add/remove spots on the detail page.
(function () {
  if (!window.PM) return;
  const errorEl = document.getElementById('collection-error');

  function setError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.classList.toggle('hidden', !message);
  }

  // ----- list page -----
  const form = document.getElementById('collection-form');
  if (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const input = document.getElementById('collection-name');
      const name = input.value.trim();
      if (!name) return;
      setError(null);
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        await window.PM.postJson('/api/collections', { name: name });
        window.location.reload();
      } catch (err) {
        setError(err.message);
        submit.disabled = false;
      }
    });
  }

  document.querySelectorAll('[data-delete-collection]').forEach(function (button) {
    button.addEventListener('click', async function () {
      if (!window.confirm('删除这个收藏夹？（不会取消机位本身的收藏）')) return;
      try {
        await window.PM.del('/api/collections/' + button.getAttribute('data-delete-collection'));
        const card = button.closest('[data-collection-id]');
        if (card) card.remove();
        const grid = document.getElementById('collection-grid');
        if (grid && grid.querySelectorAll('[data-collection-id]').length === 0) {
          grid.insertAdjacentHTML(
            'beforeend',
            '<p class="text-body" id="collection-empty">还没有收藏夹。创建一个，把收藏的机位整理进来。</p>',
          );
        }
      } catch (err) {
        setError(err.message);
      }
    });
  });

  // ----- detail page -----
  const collectionId = window.PM_COLLECTION_ID;
  if (!collectionId) return;

  const toggle = document.getElementById('toggle-picker');
  const picker = document.getElementById('favorites-picker');
  if (toggle && picker) {
    toggle.addEventListener('click', function () {
      picker.classList.toggle('hidden');
    });
  }

  document.querySelectorAll('[data-add-spot]').forEach(function (button) {
    button.addEventListener('click', async function () {
      button.disabled = true;
      try {
        await window.PM.postJson('/api/collections/' + collectionId + '/spots', {
          spotId: button.getAttribute('data-add-spot'),
        });
        window.location.reload();
      } catch (err) {
        setError(err.message);
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll('[data-remove-spot]').forEach(function (button) {
    button.addEventListener('click', async function () {
      try {
        await window.PM.del(
          '/api/collections/' + collectionId + '/spots/' + button.getAttribute('data-remove-spot'),
        );
        const card = button.closest('[data-collection-spot]');
        if (card) card.remove();
        const count = document.getElementById('collection-count');
        if (count) count.textContent = String(Math.max(0, Number(count.textContent) - 1));
      } catch (err) {
        setError(err.message);
      }
    });
  });
})();