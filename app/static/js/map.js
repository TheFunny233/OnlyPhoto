// Leaflet wrapper mirroring the reference react-leaflet behaviour.
(function () {
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

  function tileUrl() {
    return (window.PM_CONFIG && window.PM_CONFIG.tileUrl) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  }
  function attribution() {
    const name = (window.PM_CONFIG && window.PM_CONFIG.attribution) || 'OpenStreetMap contributors';
    return '&copy; <a href="https://www.openstreetmap.org/copyright">' + name + '</a>';
  }

  function pinIcon(selected, approximate) {
    const color = selected ? '#0071e3' : approximate ? '#6e6e73' : '#1d1d1f';
    const dashed = approximate ? 'border-style:dashed;' : '';
    return window.L.divIcon({
      className: '',
      html:
        '<span style="display:block;width:18px;height:18px;border-radius:50%;background:' +
        color +
        ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);' +
        dashed +
        '"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  function createMap(options) {
    const container = options.container;
    let banner = null;

    function showBanner(message) {
      if (banner) return;
      banner = document.createElement('div');
      banner.className =
        'absolute top-3 left-3 right-3 z-[500] rounded-control bg-[#fff4e5] text-[#946200] px-4 py-2 text-sm shadow-card';
      banner.textContent = message;
      container.appendChild(banner);
    }

    loadLeaflet(function () {
      const map = window.L.map(container, { scrollWheelZoom: true }).setView(
        options.center || [31.2304, 121.4737],
        options.zoom || 4,
      );
      const layer = window.L.tileLayer(tileUrl(), {
        attribution: attribution(),
        maxZoom: 19,
      });
      layer.on('tileerror', function () {
        showBanner('地图底图暂时不可用，仍可浏览下方列表与位置文字。');
      });
      layer.addTo(map);

      const markers = new Map();
      let pickMarker = null;

      function render(spots, selectedId) {
        markers.forEach(function (marker) {
          map.removeLayer(marker);
        });
        markers.clear();
        (spots || []).forEach(function (spot) {
          const marker = window.L.marker([spot.lat, spot.lng], {
            icon: pinIcon(spot.id === selectedId, spot.precision === 'approximate'),
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
      }

      function flyTo(spot) {
        if (spot) map.flyTo([spot.lat, spot.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
      }

      if (options.pick) {
        map.on('click', function (event) {
          options.pick.onPick(event.latlng.lat, event.latlng.lng);
        });
      }

      window.PM._maps = window.PM._maps || {};
      window.PM._maps[options.id] = {
        map: map,
        render: render,
        flyTo: flyTo,
        setPick: function (value) {
          if (pickMarker) {
            map.removeLayer(pickMarker);
            pickMarker = null;
          }
          if (value) {
            pickMarker = window.L.marker([value.lat, value.lng], { icon: pinIcon(true, false) }).addTo(map);
          }
        },
        recenter: function (lat, lng) {
          map.flyTo([lat, lng], 13, { duration: 0.6 });
        },
      };
      if (options.onReady) options.onReady(window.PM._maps[options.id]);
    });
  }

  window.PM = window.PM || {};
  window.PM.createMap = createMap;
})();