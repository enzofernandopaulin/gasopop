import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Station } from "@/hooks/useGasoPop";
import { formatPrice } from "@/lib/fuel";
import type { OsmStation } from "@/lib/overpass";

type Props = {
  center: { lat: number; lng: number };
  stations: Station[];
  osmStations?: OsmStation[];
  priceFor: (stationId: string) => number | null;
  cheapestId?: string | null;
  onSelect: (stationId: string) => void;
};

const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const NEUTRAL = "#94a3b8";

function priceColor(price: number | null, cheapest: boolean, cheapCut: number) {
  if (cheapest || (price !== null && price <= cheapCut)) return GREEN;
  if (price !== null) return AMBER;
  return "#ffffff";
}

function markerIcon(L: typeof import("leaflet"), color: string, label?: string) {
  const text = label
    ? `<span class="gasopop-leaflet-price">${label}</span>`
    : "";
  return L.divIcon({
    className: "gasopop-leaflet-marker-wrapper",
    html: `<div class="gasopop-leaflet-marker" style="--marker-color:${color}"><span class="gasopop-leaflet-pump">⛽</span></div>${text}`,
    iconSize: label ? [70, 42] : [34, 34],
    iconAnchor: label ? [35, 28] : [17, 17],
  });
}

/** Browser-only Leaflet map using free OpenStreetMap tiles. */
export default function GoogleStationMap({
  center,
  stations,
  osmStations = [],
  priceFor,
  cheapestId,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([center.lat, center.lng], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      layersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      cancelled = true;
      layersRef.current?.clearLayers();
      layersRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.panTo([center.lat, center.lng]);
  }, [center.lat, center.lng]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    void import("leaflet").then((L) => {
      layers.clearLayers();

      const priced = stations
        .map((station) => priceFor(station.id))
        .filter((price): price is number => price !== null)
        .sort((a, b) => a - b);
      const cheapCut = priced.length ? priced[Math.floor(priced.length * 0.34)]! : Infinity;

      L.circleMarker([center.lat, center.lng], {
        radius: 9,
        color: "#ffffff",
        weight: 3,
        fillColor: "#1d6fe0",
        fillOpacity: 1,
      })
        .bindTooltip("Você está aqui")
        .addTo(layers);

      const known = new Set(
        stations.map((station) => `${station.latitude.toFixed(4)},${station.longitude.toFixed(4)}`),
      );

      osmStations.forEach((station) => {
        if (known.has(`${station.latitude.toFixed(4)},${station.longitude.toFixed(4)}`)) return;
        L.marker([station.latitude, station.longitude], {
          icon: markerIcon(L, NEUTRAL),
        })
          .bindTooltip(`${station.name} · sem preço reportado`)
          .addTo(layers);
      });

      stations.forEach((station) => {
        const price = priceFor(station.id);
        const label = price !== null ? `R$ ${formatPrice(price)}` : undefined;
        const marker = L.marker([station.latitude, station.longitude], {
          icon: markerIcon(L, priceColor(price, station.id === cheapestId, cheapCut), label),
          zIndexOffset: station.id === cheapestId ? 999 : 500,
        })
          .bindTooltip(`${station.name}${label ? ` · ${label}` : ""}`)
          .on("click", () => onSelect(station.id));
        marker.addTo(layers);
      });
    });
  }, [stations, osmStations, center.lat, center.lng, cheapestId, priceFor, onSelect]);

  return <div ref={containerRef} className="h-full w-full" />;
}
