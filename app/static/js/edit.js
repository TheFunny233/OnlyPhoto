// Deterministic pixel maths mirrored from pixel.ts / editmath.py.
(function () {
  const DEFAULT_RECIPE = { crop: null, exposureEv: 0, contrast: 0, saturation: 0, warmth: 0 };

  function clamp(v, low, high) {
    return Math.min(high, Math.max(low, v));
  }
  function clamp255(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  function normalizeCrop(crop) {
    if (!crop) return null;
    const x = clamp(Number(crop.x) || 0, 0, 1);
    const y = clamp(Number(crop.y) || 0, 0, 1);
    const width = clamp(Number(crop.width) || 0, 0, 1 - x);
    const height = clamp(Number(crop.height) || 0, 0, 1 - y);
    if (width < 0.05 || height < 0.05) return null;
    if (width > 0.999 && height > 0.999) return null;
    return { x, y, width, height };
  }

  function normalizeRecipe(recipe) {
    const r = recipe || {};
    return {
      crop: normalizeCrop(r.crop),
      exposureEv: clamp(Number(r.exposureEv) || 0, -1, 1),
      contrast: clamp(Number(r.contrast) || 0, -20, 20),
      saturation: clamp(Number(r.saturation) || 0, -20, 20),
      warmth: clamp(Number(r.warmth) || 0, -20, 20),
    };
  }

  function cropRect(crop, width, height) {
    const c = normalizeCrop(crop);
    if (!c) return { left: 0, top: 0, width, height };
    const left = Math.round(c.x * width);
    const top = Math.round(c.y * height);
    const w = Math.max(1, Math.round(c.width * width));
    const h = Math.max(1, Math.round(c.height * height));
    return { left, top, width: Math.min(w, width - left), height: Math.min(h, height - top) };
  }

  function transformPixels(data, recipe) {
    const r = normalizeRecipe(recipe);
    const expMul = Math.pow(2, r.exposureEv);
    const cFactor = 1 + r.contrast / 100;
    const sFactor = 1 + r.saturation / 100;
    const warmShift = r.warmth * 1.5;
    for (let i = 0; i < data.length; i += 4) {
      let red = data[i] * expMul;
      let green = data[i + 1] * expMul;
      let blue = data[i + 2] * expMul;
      red = (red - 128) * cFactor + 128;
      green = (green - 128) * cFactor + 128;
      blue = (blue - 128) * cFactor + 128;
      const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      red = luma + (red - luma) * sFactor;
      green = luma + (green - luma) * sFactor;
      blue = luma + (blue - luma) * sFactor;
      red += warmShift;
      blue -= warmShift;
      data[i] = clamp255(Math.round(red));
      data[i + 1] = clamp255(Math.round(green));
      data[i + 2] = clamp255(Math.round(blue));
    }
    return data;
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error('图片加载失败'));
      };
      img.src = src;
    });
  }

  async function renderToCanvas(canvas, src, recipe) {
    const img = await loadImage(src);
    const rect = cropRect(recipe.crop, img.naturalWidth, img.naturalHeight);
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height, 0, 0, rect.width, rect.height);
    const imageData = ctx.getImageData(0, 0, rect.width, rect.height);
    transformPixels(imageData.data, recipe);
    ctx.putImageData(imageData, 0, 0);
  }

  function exportCanvas(canvas, type) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('导出失败'));
        },
        type,
        type === 'image/jpeg' ? 0.92 : 0.9,
      );
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  window.PM = window.PM || {};
  window.PM.edit = {
    DEFAULT_RECIPE,
    normalizeRecipe,
    normalizeCrop,
    cropRect,
    transformPixels,
    renderToCanvas,
    exportCanvas,
    downloadBlob,
  };
})();