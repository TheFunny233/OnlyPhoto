// Follow toggle on a user profile page.
(function () {
  const user = window.PM_USER;
  const button = document.getElementById('follow-button');
  if (!user || !button || !window.PM) return;
  const errorEl = document.getElementById('user-error');

  button.addEventListener('click', async function () {
    const active = button.getAttribute('data-active') === '1';
    button.setAttribute('data-active', active ? '0' : '1');
    button.textContent = active ? '关注' : '已关注';
    try {
      const res = await window.PM.postJson('/api/users/' + user.id + '/follow', {});
      button.setAttribute('data-active', res.following ? '1' : '0');
      button.textContent = res.following ? '已关注' : '关注';
      const stat = document.querySelector('[data-stat="粉丝"]');
      if (stat) stat.textContent = res.followers;
    } catch (err) {
      button.setAttribute('data-active', active ? '1' : '0');
      button.textContent = active ? '已关注' : '关注';
      if (err.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
      }
    }
  });
})();