// Shared client helpers (mirrors the reference client/api.ts behaviour).
(function () {
  class ApiRequestError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  async function apiFetch(input, init) {
    const options = Object.assign({}, init);
    const headers = Object.assign({}, (init && init.headers) || {});
    if (init && init.body && !(init.body instanceof FormData)) {
      headers['content-type'] = 'application/json';
    }
    options.headers = headers;
    const response = await fetch(input, options);
    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        data = {};
      }
    }
    if (!response.ok) {
      const err = (data && data.error) || {};
      throw new ApiRequestError(response.status, err.code || 'error', err.message || `请求失败（${response.status}）`);
    }
    return data;
  }

  function postJson(url, body) {
    return apiFetch(url, { method: 'POST', body: JSON.stringify(body) });
  }
  function patchJson(url, body) {
    return apiFetch(url, { method: 'PATCH', body: JSON.stringify(body) });
  }
  function putJson(url, body) {
    return apiFetch(url, { method: 'PUT', body: JSON.stringify(body) });
  }
  function del(url) {
    return apiFetch(url, { method: 'DELETE' });
  }

  function showError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('hidden');
  }
  function clearError(element) {
    if (!element) return;
    element.textContent = '';
    element.classList.add('hidden');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('zh-CN');
  }

  window.PM = { apiFetch, postJson, patchJson, putJson, del, showError, clearError, escapeHtml, formatDate, ApiRequestError };

  function bindAuthForms() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const errorEl = document.getElementById('form-error');
        clearError(errorEl);
        const button = loginForm.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
          await postJson('/api/auth/login', {
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
          });
          window.location.href = '/studio';
        } catch (err) {
          showError(errorEl, err.message);
          button.disabled = false;
        }
      });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const errorEl = document.getElementById('form-error');
        clearError(errorEl);
        const button = registerForm.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
          await postJson('/api/auth/register', {
            nickname: document.getElementById('nickname').value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
          });
          window.location.href = '/studio';
        } catch (err) {
          showError(errorEl, err.message);
          button.disabled = false;
        }
      });
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', async () => {
        try {
          await postJson('/api/auth/logout', {});
        } finally {
          window.location.href = '/';
        }
      });
    }
  }

  async function loadNotificationBadge() {
    const badge = document.getElementById('nav-notification-badge');
    if (!badge) return;
    try {
      const data = await apiFetch('/api/notifications?unread=1');
      if (data.unread > 0) {
        badge.textContent = data.unread > 99 ? '99+' : String(data.unread);
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    } catch (err) {
      /* not signed in or offline */
    }
  }

  function bindAccountMenu() {
    const wrap = document.getElementById('account-menu-wrap');
    const button = document.getElementById('account-menu-button');
    const menu = document.getElementById('account-menu');
    if (!wrap || !button || !menu) return;

    function close() {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
    function toggle() {
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      button.setAttribute('aria-expanded', String(willOpen));
    }

    button.addEventListener('click', function (event) {
      event.stopPropagation();
      toggle();
    });
    document.addEventListener('click', function (event) {
      if (!wrap.contains(event.target)) close();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });
    menu.querySelectorAll('[role="menuitem"], a').forEach(function (item) {
      item.addEventListener('click', function () {
        close();
      });
    });

    const logout = document.getElementById('menu-logout');
    if (logout)
      logout.addEventListener('click', async function () {
        try {
          await postJson('/api/auth/logout', {});
        } finally {
          window.location.href = '/';
        }
      });

    const switchAccount = document.getElementById('switch-account');
    if (switchAccount)
      switchAccount.addEventListener('click', async function () {
        try {
          await postJson('/api/auth/logout', {});
        } finally {
          window.location.href = '/login?switch=1';
        }
      });
  }

  function showSwitchNotice() {
    const notice = document.getElementById('switch-notice');
    if (!notice) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('switch') === '1') notice.hidden = false;
  }

  function boot() {
    bindAuthForms();
    bindAccountMenu();
    loadNotificationBadge();
    showSwitchNotice();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();