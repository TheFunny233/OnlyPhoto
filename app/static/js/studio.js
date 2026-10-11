// Studio: pick file, consent, upload.
(function () {
  const input = document.getElementById('file-input');
  if (!input) return;
  const consentPanel = document.getElementById('consent-panel');
  const consentName = document.getElementById('consent-name');
  const consentCheckbox = document.getElementById('consent-checkbox');
  const confirmButton = document.getElementById('confirm-upload');
  const cancelButton = document.getElementById('cancel-upload');
  const pickButton = document.getElementById('pick-file');
  const dropZone = document.getElementById('drop-zone');
  const errorEl = document.getElementById('upload-error');
  let pending = null;

  function setError(message) {
    if (!message) {
      errorEl.classList.add('hidden');
      return;
    }
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function choose(file) {
    setError(null);
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setError('文件超过 15MB 限制');
      return;
    }
    pending = file;
    consentName.textContent = file.name;
    consentCheckbox.checked = false;
    confirmButton.disabled = true;
    consentPanel.classList.remove('hidden');
  }

  pickButton.addEventListener('click', function () {
    input.click();
  });
  input.addEventListener('change', function () {
    choose(input.files && input.files[0]);
  });

  dropZone.addEventListener('dragover', function (event) {
    event.preventDefault();
  });
  dropZone.addEventListener('drop', function (event) {
    event.preventDefault();
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    choose(file);
  });

  consentCheckbox.addEventListener('change', function () {
    confirmButton.disabled = !consentCheckbox.checked;
  });
  cancelButton.addEventListener('click', function () {
    pending = null;
    consentPanel.classList.add('hidden');
    input.value = '';
  });

  confirmButton.addEventListener('click', async function () {
    if (!pending) return;
    setError(null);
    confirmButton.disabled = true;
    confirmButton.textContent = '正在上传…';
    try {
      const form = new FormData();
      form.append('file', pending);
      const data = await window.PM.apiFetch('/api/photos', { method: 'POST', body: form });
      window.location.href = '/studio/' + data.photo.id;
    } catch (err) {
      setError(err.message);
      confirmButton.disabled = false;
      confirmButton.textContent = '上传并继续';
    }
  });
})();