// Maintenance page. The token lives only in this tab's memory (never in the URL or storage).
(function () {
  if (!window.PM) return;
  let token = '';

  const errorEl = document.getElementById('admin-error');
  const tokenInput = document.getElementById('maintenance-token');
  const reportsWrap = document.getElementById('reports-wrap');
  const reportList = document.getElementById('report-list');
  const reportCount = document.getElementById('report-count');
  const onlyOpen = document.getElementById('only-open');
  let reports = [];

  function setError(message) {
    errorEl.textContent = message || '';
    errorEl.classList.toggle('hidden', !message);
  }

  async function adminFetch(url, options) {
    const opts = options || {};
    const headers = Object.assign({}, opts.headers || {}, { 'x-maintenance-token': token });
    if (opts.body) headers['content-type'] = 'application/json';
    const response = await fetch(url, Object.assign({}, opts, { headers: headers }));
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error((data.error && data.error.message) || `请求失败（${response.status}）`);
    }
    return data;
  }

  function render() {
    const visible = onlyOpen.checked ? reports.filter((r) => r.status === 'open') : reports;
    reportCount.textContent = String(visible.length);
    if (visible.length === 0) {
      reportList.innerHTML = '<li class="text-sm text-muted">没有举报记录。</li>';
      return;
    }
    reportList.innerHTML = visible
      .map(function (report) {
        const targetHref =
          report.targetType === 'spot' ? '/spots/' + report.targetId : null;
        return (
          '<li class="bg-surface rounded-card shadow-card p-4" data-report-id="' + report.id + '">' +
          '<div class="flex items-center gap-2 text-xs text-muted"><span>' +
          window.PM.escapeHtml(report.targetType) +
          '</span><span>· ' +
          window.PM.escapeHtml(report.status) +
          '</span><span>· ' +
          window.PM.formatDate(report.createdAt) +
          '</span></div>' +
          '<p class="mt-2 text-sm text-body">' +
          window.PM.escapeHtml(report.reason) +
          '</p>' +
          '<p class="mt-1 text-xs text-muted">对象 ID：' +
          window.PM.escapeHtml(report.targetId) +
          (targetHref ? ' · <a class="text-accent hover:underline" href="' + targetHref + '">查看机位</a>' : '') +
          '</p>' +
          '<div class="mt-3 flex gap-2">' +
          '<button type="button" data-action="hide" data-report="' + report.id + '" class="inline-flex items-center rounded-full px-4 py-2 text-sm min-h-[40px] bg-danger text-white">隐藏内容</button>' +
          '<button type="button" data-action="resolve" data-report="' + report.id + '" class="inline-flex items-center rounded-full px-4 py-2 text-sm min-h-[40px] bg-surface text-ink border border-line hover:bg-page">标记已处理</button>' +
          '</div></li>'
        );
      })
      .join('');

    reportList.querySelectorAll('[data-action]').forEach(function (button) {
      button.addEventListener('click', async function () {
        button.disabled = true;
        try {
          await adminFetch('/api/admin/reports', {
            method: 'POST',
            body: JSON.stringify({ reportId: button.getAttribute('data-report'), action: button.getAttribute('data-action') }),
          });
          const item = reports.find((r) => r.id === button.getAttribute('data-report'));
          if (item) item.status = 'resolved';
          render();
        } catch (err) {
          setError(err.message);
          button.disabled = false;
        }
      });
    });
  }

  document.getElementById('load-reports').addEventListener('click', async function () {
    setError(null);
    token = tokenInput.value.trim();
    if (!token) {
      setError('请输入维护令牌');
      return;
    }
    try {
      const data = await adminFetch('/api/admin/reports');
      reports = data.reports || [];
      reportsWrap.classList.remove('hidden');
      render();
    } catch (err) {
      setError(err.message);
      reportsWrap.classList.add('hidden');
    }
  });

  document.getElementById('clear-token').addEventListener('click', function () {
    token = '';
    tokenInput.value = '';
    reports = [];
    reportsWrap.classList.add('hidden');
    setError(null);
  });

  if (onlyOpen) onlyOpen.addEventListener('change', render);
})();