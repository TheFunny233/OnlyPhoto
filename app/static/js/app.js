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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAuthForms);
  } else {
    bindAuthForms();
  }
})();