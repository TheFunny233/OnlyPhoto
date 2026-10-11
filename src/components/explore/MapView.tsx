'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { env } from '@/lib/client/publicEnv';

export type MapSpot = {
  id: string;
  title: string;
  city: string;
  lat: number;
  lng: number;
  precision: string;
};

function pinIcon(selected: boolean, approximate: boolean) {
  const color = selected ? '#0071e3' : approximate ? '#6e6e73' : '#1d1d1f';
  const ring = approximate ? 'border-style:dashed;' : '';
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);${ring}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function FlyToSelected({ spot }: { spot: MapSpot | null }) {
  const map = useMap();
  useEffect(() => {
    if (spot) map.flyTo([spot.lat, spot.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [spot, map]);
  return null;
}

function TileErrorWatcher({ onError }: { onError: () => void }) {
  useMapEvents({
    tileerror() {
      onError();
    },
  });
  return null;
}

function ClickPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export default function MapView({
  spots,
  selectedId,
  onSelect,
  recenter,
  pick,
}: {
  spots: MapSpot[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  recenter?: { lat: number; lng: number; key: number } | null;
  pick?: { value: { lat: number; lng: number } | null; onPick: (lat: number, lng: number) => void };
}) {
  const [tileError, setTileError] = useState(false);
  const selected = spots.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="relative h-full w-full">
      {tileError ? (
        <div className="absolute top-3 left-3 right-3 z-[500] rounded-control bg-[#fff4e5] text-[#946200] px-4 py-2 text-sm shadow-card">
          地图底图暂时不可用，仍可浏览下方列表与位置文字。
        </div>
      ) : null}
      <MapContainer
        center={[31.2304, 121.4737]}
        zoom={4}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url={env.mapTileUrl}
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">${env.mapAttribution}</a>`}
        />
        <TileErrorWatcher onError={() => setTileError(true)} />
        <FlyToSelected spot={selected} />
        <Recenter recenter={recenter} />
        {pick ? <ClickPicker onPick={pick.onPick} /> : null}
        {pick?.value ? (
          <Marker position={[pick.value.lat, pick.value.lng]} icon={pinIcon(true, false)}>
            <Popup>你选择的位置</Popup>
          </Marker>
        ) : null}
        {spots.map((spot) => (
          <Marker
            key={spot.id}
            position={[spot.lat, spot.lng]}
            icon={pinIcon(spot.id === selectedId, spot.precision === 'approximate')}
            eventHandlers={{ click: () => onSelect(spot.id) }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{spot.title}</strong>
                <br />
                {spot.city} {spot.precision === 'approximate' ? '（大致位置）' : ''}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function Recenter({ recenter }: { recenter?: { lat: number; lng: number; key: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (recenter) map.flyTo([recenter.lat, recenter.lng], 13, { duration: 0.6 });
  }, [recenter, map]);
  return null;
}