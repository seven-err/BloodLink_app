import {
  getMapLibreStyle,
  regionToZoom,
  type MapViewMode,
} from '@/constants/mapTiles';

type MapLibreMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  pinColor?: string;
  selectedPinColor?: string;
  bloodType?: string;
};

type MapLibreRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const MIN_ZOOM = 4;
const MAX_ZOOM = 18;

type MapLibreUserLocation = {
  latitude: number;
  longitude: number;
} | null;

export const buildMapLibreMapHtml = (
  region: MapLibreRegion,
  markers: MapLibreMarker[],
  selectedMarkerId: string | null = null,
  mapMode: MapViewMode = 'standard',
  userLocation: MapLibreUserLocation = null,
) => {
  const zoom = regionToZoom(region.latitudeDelta);
  const markersJson = JSON.stringify(
    markers.map((marker) => ({
      ...marker,
      selected: marker.id === selectedMarkerId,
    })),
  );
  const styleJson = JSON.stringify(getMapLibreStyle(mapMode));
  const userLocationJson = JSON.stringify(userLocation);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
    <style>
      html, body, #map { margin: 0; height: 100%; width: 100%; background: #e5e7eb; }
      .maplibregl-ctrl-attrib { display: none; }
      .maplibregl-ctrl-top-right { display: none; }
      .maplibregl-marker {
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      .marker-pin-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        touch-action: manipulation;
        pointer-events: auto !important;
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .marker-pin-wrap.selected {
        transform: scale(1.22);
        z-index: 9999;
      }
      .marker-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px 8px;
        background: #64748b;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-weight: 800;
        font-size: 12px;
        border-radius: 12px;
        border: 2px solid #ffffff;
        box-shadow: 0 3px 10px rgba(0,0,0,0.32);
        white-space: nowrap;
        line-height: 1;
      }
      .marker-pin-tail {
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 5px solid #64748b;
        margin-top: -1px;
      }
      .custom-donor-popup .maplibregl-popup-content {
        padding: 10px 12px;
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.24);
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .custom-donor-popup .maplibregl-popup-tip {
        border-top-color: #ffffff;
      }
      .donor-popup-card {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 140px;
        max-width: 220px;
      }
      .donor-popup-header {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .donor-popup-pill {
        background: #dc2626;
        color: #ffffff;
        font-weight: 800;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 6px;
        flex-shrink: 0;
      }
      .donor-popup-name {
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .donor-popup-desc {
        font-size: 11px;
        font-weight: 500;
        color: #64748b;
        margin-top: 1px;
      }
      .donor-popup-hint {
        font-size: 10px;
        font-weight: 600;
        color: #64748b;
        margin-top: 3px;
      }
      .user-location {
        position: relative;
        width: 18px;
        height: 18px;
      }
      .user-location-pulse {
        position: absolute;
        inset: -8px;
        border-radius: 999px;
        background: rgba(59, 130, 246, 0.28);
        animation: user-pulse 1.8s ease-out infinite;
      }
      .user-location-dot {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: #3b82f6;
        border: 2.5px solid #fff;
        box-shadow: 0 1px 6px rgba(30, 64, 175, 0.45);
      }
      @keyframes user-pulse {
        0% { transform: scale(0.7); opacity: 0.85; }
        100% { transform: scale(1.55); opacity: 0; }
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
    <script>
      const region = ${JSON.stringify(region)};
      const markers = ${markersJson};
      const zoom = ${zoom};
      const style = ${styleJson};
      const userLocation = ${userLocationJson};
      const minZoom = ${MIN_ZOOM};
      const maxZoom = ${MAX_ZOOM};

      function post(payload) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          } else if (window.parent && window.parent.postMessage) {
            window.parent.postMessage(JSON.stringify(payload), '*');
          }
        } catch (e) {}
      }

      const map = new maplibregl.Map({
        container: 'map',
        style: style,
        center: [region.longitude, region.latitude],
        zoom: zoom,
        minZoom: minZoom,
        maxZoom: maxZoom,
        attributionControl: false,
      });

      window.__bloodlinkZoom = function(delta) {
        const next = Math.min(maxZoom, Math.max(minZoom, map.getZoom() + delta));
        map.easeTo({ zoom: next, duration: 220 });
      };

      window.__lastMarkerPressTime = 0;

      map.on('click', function(e) {
        if (Date.now() - window.__lastMarkerPressTime < 500) {
          return;
        }
        if (e && e.originalEvent && e.originalEvent.target) {
          const target = e.originalEvent.target;
          if (
            target.closest &&
            (target.closest('.marker-pin-wrap') ||
              target.closest('.maplibregl-marker') ||
              target.closest('.custom-donor-popup') ||
              target.closest('.maplibregl-popup'))
          ) {
            return;
          }
        }
        post({ type: 'mapPress' });
      });

      window.__bloodlinkMarkers = [];

      markers.forEach(function(marker) {
        const defaultColor = marker.pinColor || '#64748b';
        const activeColor = marker.selectedPinColor || '#b91c1c';
        const color = marker.selected ? activeColor : defaultColor;

        const el = document.createElement('div');
        el.className = 'marker-pin-wrap' + (marker.selected ? ' selected' : '');

        const badge = document.createElement('div');
        badge.className = 'marker-badge';
        badge.style.background = color;
        badge.innerText = marker.bloodType ? marker.bloodType : (marker.title || '');

        const tail = document.createElement('div');
        tail.className = 'marker-pin-tail';
        tail.style.borderTopColor = color;

        el.appendChild(badge);
        el.appendChild(tail);

        const safeTitle = (marker.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeBlood = (marker.bloodType || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeDesc = (marker.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const popupHtml = '<div class="donor-popup-card">' +
          '<div class="donor-popup-header">' +
            (safeBlood ? '<span class="donor-popup-pill">' + safeBlood + '</span>' : '') +
            '<span class="donor-popup-name">' + safeTitle + '</span>' +
          '</div>' +
          (safeDesc ? '<div class="donor-popup-desc">' + safeDesc + '</div>' : '') +
          '<div class="donor-popup-hint">Tap card below for directions & profile</div>' +
        '</div>';

        const popup = new maplibregl.Popup({
          offset: [0, -30],
          closeButton: false,
          closeOnClick: false,
          className: 'custom-donor-popup'
        }).setHTML(popupHtml);

        const markerInstance = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([marker.longitude, marker.latitude])
          .setPopup(popup)
          .addTo(map);

        if (marker.selected) {
          popup.addTo(map);
        }

        window.__bloodlinkMarkers.push({
          id: marker.id,
          el: el,
          popup: popup,
          marker: marker
        });

        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let lastTriggerTime = 0;

        function triggerMarkerSelection(event) {
          const now = Date.now();
          window.__lastMarkerPressTime = now;
          if (now - lastTriggerTime < 250) {
            return;
          }
          lastTriggerTime = now;

          if (event) {
            if (event.stopPropagation) event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            if (event.preventDefault && event.cancelable) event.preventDefault();
          }

          post({ type: 'markerPress', id: marker.id });
        }

        function handleTouchStart(e) {
          if (e.stopPropagation) e.stopPropagation();
          const touch = e.touches ? e.touches[0] : e;
          touchStartX = touch.clientX;
          touchStartY = touch.clientY;
          touchStartTime = Date.now();
        }

        function handleTouchEnd(e) {
          if (e.stopPropagation) e.stopPropagation();
          const touch = e.changedTouches ? e.changedTouches[0] : (e.touches ? e.touches[0] : e);
          const deltaX = Math.abs((touch ? touch.clientX : touchStartX) - touchStartX);
          const deltaY = Math.abs((touch ? touch.clientY : touchStartY) - touchStartY);
          const elapsed = Date.now() - touchStartTime;

          // If touch was a quick tap with minimal movement (< 20px, < 500ms), trigger immediately
          if (deltaX < 20 && deltaY < 20 && elapsed < 500) {
            triggerMarkerSelection(e);
          }
        }

        el.addEventListener('touchstart', handleTouchStart, { passive: false });
        el.addEventListener('touchend', handleTouchEnd, { passive: false });
        el.addEventListener('pointerdown', function(e) {
          if (e.stopPropagation) e.stopPropagation();
        });
        el.addEventListener('mousedown', function(e) {
          if (e.stopPropagation) e.stopPropagation();
        });
        el.addEventListener('click', triggerMarkerSelection);
      });

      window.__bloodlinkSetSelectedMarker = function(id) {
        window.__bloodlinkMarkers.forEach(function(m) {
          const isSelected = m.id === id;
          if (m.marker.selected === isSelected) return;
          m.marker.selected = isSelected;

          const defaultColor = m.marker.pinColor || '#64748b';
          const activeColor = m.marker.selectedPinColor || '#b91c1c';
          const color = isSelected ? activeColor : defaultColor;

          m.el.className = 'marker-pin-wrap' + (isSelected ? ' selected' : '');
          m.el.querySelector('.marker-badge').style.background = color;
          m.el.querySelector('.marker-pin-tail').style.borderTopColor = color;

          if (isSelected) {
            m.popup.addTo(map);
          } else {
            m.popup.remove();
          }
        });
      };

      if (userLocation && Number.isFinite(userLocation.latitude) && Number.isFinite(userLocation.longitude)) {
        const el = document.createElement('div');
        el.className = 'user-location';
        el.setAttribute('aria-label', 'Your location');
        const pulse = document.createElement('div');
        pulse.className = 'user-location-pulse';
        const dot = document.createElement('div');
        dot.className = 'user-location-dot';
        el.appendChild(pulse);
        el.appendChild(dot);
        new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([userLocation.longitude, userLocation.latitude])
          .addTo(map);
      }
    </script>
  </body>
</html>`;
};

export const buildMapLibreMapSrcDoc = (
  region: MapLibreRegion,
  markers: MapLibreMarker[],
  selectedMarkerId: string | null = null,
  mapMode: MapViewMode = 'standard',
  userLocation: MapLibreUserLocation = null,
) => buildMapLibreMapHtml(region, markers, selectedMarkerId, mapMode, userLocation);
