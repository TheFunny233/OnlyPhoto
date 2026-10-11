// Map abstraction: Gaode/AMap when configured, OpenStreetMap (Leaflet) otherwise.
// The database stores WGS84; AMap renders GCJ-02, so coordinates are converted in/out here.
(function () {
  const config = window.PM_CONFIG || {};
  const usingAmap = config.provider === 'amap' && !!config.amapKey;

  // ---------- loaders ----------
  function loadLeaflet(callback) {
    if (window.L) {
      callback();
      return;
    }
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/static/leaflet/leaflet.css';
      link.setAttribute('data-leaflet', '1');
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = '/static/leaflet/leaflet.js';
    script.onload = callback;
    document.body.appendChild(script);
  }

  function loadAmap(callback, onError) {
    if (window.AMap) {
      callback();
      return;
    }
    if (config.amapSecurityCode) {
      window._AMapSecurityConfig = { securityJsCode: config.amapSecurityCode };
    }
    const script = document.createElement('script');
    // AMap JS 1.4 uses raster tiles (no WebGL requirement), so it renders reliably
    // in headless browsers and on machines without GPU acceleration.
    script.src = 'https://webapi.amap.com/maps?v=1.4.15&key=' + encodeURIComponent(config.amapKey);
    script.onload = function () {
      if (window.AMap) callback();
      else onError();
    };
    script.onerror = onError;
    document.head.appendChild(script);
  }

  function pinHtml(selected, approximate) {
    const color = selected ? '#0071e3' : approximate ? '#6e6e73' : '#1d1d1f';
    const dashed = approximate ? 'border-style:dashed;' : '';
    return (
      '<span style="display:block;width:18px;height:18px;border-radius:50%;background:' +
      color +
      ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);' +
      dashed +
      '"></span>'
    );
  }

  function makeBanner(container, message) {
    if (container.querySelector('[data-map-banner]')) return;
    const banner = document.createElement('div');
    banner.setAttribute('data-map-banner', '1');
    banner.className =
      'absolute top-3 left-3 right-3 z-[500] rounded-control bg-[#fff4e5] text-[#946200] px-4 py-2 text-sm shadow-card';
    banner.textContent = message;
    container.appendChild(banner);
  }

  // ---------- implementations ----------
  function createLeaflet(options, container) {
    loadLeaflet(function () {
      const map = window.L.map(container, { scrollWheelZoom: true }).setView(
        options.center || [31.2304, 121.4737],
        options.zoom || 4,
      );
      const layer = window.L.tileLayer(config.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">' +
          (config.attribution || 'OpenStreetMap contributors') +
          '</a>',
        maxZoom: 19,
      });
      layer.on('tileerror', function () {
        makeBanner(container, '地图底图暂时不可用，仍可浏览下方列表与位置文字。');
      });
      layer.addTo(map);

      const markers = new Map();
      let pickMarker = null;

      const api = {
        map: map,
        render: function (spots, selectedId) {
          markers.forEach(function (marker) {
            map.removeLayer(marker);
          });
          markers.clear();
          (spots || []).forEach(function (spot) {
            const marker = window.L.marker([spot.lat, spot.lng], {
              icon: window.L.divIcon({
                className: '',
                html: pinHtml(spot.id === selectedId, spot.precision === 'approximate'),
                iconSize: [18, 18],
                iconAnchor: [9, 9],
              }),
            });
            marker.bindPopup(
              '<div class="text-sm"><strong>' +
                window.PM.escapeHtml(spot.title) +
                '</strong><br>' +
                window.PM.escapeHtml(spot.city || '') +
                (spot.precision === 'approximate' ? '（大致位置）' : '') +
                '</div>',
            );
            marker.on('click', function () {
              if (options.onSelect) options.onSelect(spot.id);
            });
            marker.addTo(map);
            markers.set(spot.id, marker);
          });
        },
        flyTo: function (spot) {
          if (spot) map.flyTo([spot.lat, spot.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
        },
        setPick: function (value) {
          if (pickMarker) {
            map.removeLayer(pickMarker);
            pickMarker = null;
          }
          if (value) {
            pickMarker = window.L.marker([value.lat, value.lng], {
              icon: window.L.divIcon({ className: '', html: pinHtml(true, false), iconSize: [18, 18], iconAnchor: [9, 9] }),
            }).addTo(map);
          }
        },
        recenter: function (lat, lng) {
          map.flyTo([lat, lng], 13, { duration: 0.6 });
        },
      };
      if (options.pick) {
        map.on('click', function (event) {
          options.pick.onPick(event.latlng.lat, event.latlng.lng);
        });
      }
      if (options.onReady) options.onReady(api);
    });
  }

  function createAmap(options, container) {
    loadAmap(
      function () {
        const coord = window.PM.coord;
        const toGcj = function (lng, lat) {
          return coord ? coord.wgs84ToGcj02(lng, lat) : [lng, lat];
        };
        const toWgs = function (lng, lat) {
          return coord ? coord.gcj02ToWgs84(lng, lat) : [lng, lat];
        };
        // options.center is [lng, lat] (same order as AMap); toGcj expects (lng, lat).
        const center = options.center || [121.4737, 31.2304];
        const centerGcj = toGcj(center[0], center[1]);
const map = new window.AMap.Map(container, {
          zoom: options.zoom || 4,
          center: centerGcj,
          resizeEnable: true,
        });
        // Prefer the raster basemap so the map renders without WebGL/GPU too.
        if (window.AMap.TileLayer && typeof map.setLayers === 'function') {
          try {
            map.setLayers([new window.AMap.TileLayer({ zIndex: 1 })]);
          } catch (error) {
            /* keep the default layers */
          }
        }

        const markers = [];
        let pickMarker = null;

        const api = {
          map: map,
          render: function (spots, selectedId) {
            if (markers.length) {
              map.remove(markers);
              markers.length = 0;
              if (options.pick) map.clearMap();
            }
            (spots || []).forEach(function (spot) {
              const point = toGcj(spot.lng, spot.lat);
              const marker = new window.AMap.Marker({
                position: point,
                content: pinHtml(spot.id === selectedId, spot.precision === 'approximate'),
                offset: new window.AMap.Pixel(-9, -9),
                anchor: 'top-left',
                title: spot.title,
              });
              marker.on('click', function () {
                if (options.onSelect) options.onSelect(spot.id);
              });
              marker.setMap(map);
              markers.push(marker);
            });
          },
          flyTo: function (spot) {
            if (!spot) return;
            const point = toGcj(spot.lng, spot.lat);
            map.setZoomAndCenter(Math.max(map.getZoom(), 13), point);
          },
          setPick: function (value) {
            if (pickMarker) {
              map.remove(pickMarker);
              pickMarker = null;
            }
            if (value) {
              const point = toGcj(value.lng, value.lat);
              pickMarker = new window.AMap.Marker({
                position: point,
                content: pinHtml(true, false),
                offset: new window.AMap.Pixel(-9, -9),
              });
              pickMarker.setMap(map);
            }
          },
          recenter: function (lat, lng) {
            const point = toGcj(lng, lat);
            map.setZoomAndCenter(13, point);
          },
        };

        if (options.pick) {
          map.on('click', function (event) {
            const wgs = toWgs(event.lnglat.getLng(), event.lnglat.getLat());
            options.pick.onPick(wgs[1], wgs[0]);
          });
        }
        window.PM._maps = window.PM._maps || {};
        window.PM._maps[options.id] = api;
        if (options.onReady) options.onReady(api);
      },
      function () {
        makeBanner(container, '高德地图加载失败，已回退到 OpenStreetMap。');
        createLeaflet(options, container);
      },
    );
  }

  function createMap(options) {
    const container = options.container;
    if (!container) return;
    if (container.querySelector('[data-map-fallback]')) return;
    if (!usingAmap && config.provider === 'amap' && !config.amapKey) {
      const note = document.createElement('div');
      note.setAttribute('data-map-banner', '1');
      note.className =
        'absolute top-3 left-3 right-3 z-[500] rounded-control bg-[#fff4e5] text-[#946200] px-4 py-2 text-sm shadow-card';
      note.textContent = '未配置高德地图 Key（AMAP_JS_KEY），当前使用 OpenStreetMap 底图。';
      container.appendChild(note);
      setTimeout(function () {
        note.remove();
      }, 6000);
    }
    if (usingAmap) createAmap(options, container);
    else createLeaflet(options, container);
  }

  window.PM = window.PM || {};
  window.PM.createMap = createMap;
  window.PM.mapProvider = usingAmap ? 'amap' : 'osm';
})();