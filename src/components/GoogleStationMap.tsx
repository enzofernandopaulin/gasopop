/// <reference types="google.maps" />
import { useEffect, useRef } from "react";
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

declare global {
  interface Window {
    __gasopopMapsReady?: () => void;
    google?: typeof google;
  }
}

let mapsPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps) return Promise.resolve();
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<void>((resolve, reject) => {
    const key = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'];
    const channel = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID'] ?? "";
    if (!key) {
      reject(new Error("Google Maps key missing"));
      return;
    }
    window.__gasopopMapsReady = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__gasopopMapsReady&channel=${channel}`;
    script.async = true;
    script.onerror = () => reject(new Error("Falha ao carregar o Google Maps"));
    document.head.appendChild(script);
  });
  return mapsPromise;
}

/** Fuel-pump shaped marker, tinted by how good the price is. */
function pumpIcon(fill: string, stroke: string, scale = 1) {
  return {
    path: "M4 2h8a2 2 0 0 1 2 2v18H2V4a2 2 0 0 1 2-2Zm1 3h6v4H5V5Zm11 5h1a2 2 0 0 1 2 2v6a1 1 0 0 0 2 0v-7l-3-3V6l4.5 4.5V18a3 3 0 0 1-6 0v-6h-0.5V10Z",
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: stroke,
    strokeWeight: 1.5,
    scale,
    anchor: new google.maps.Point(12, 22),
  } as google.maps.Symbol;
}

const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const NEUTRAL = "#94a3b8";

/** Browser-only Google map. Import lazily behind <ClientOnly>. */
export default function GoogleStationMap({
  center,
  stations,
  osmStations = [],
  priceFor,
  cheapestId,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
      })
      .catch((error: Error) => {
        if (containerRef.current) {
          containerRef.current.textContent = error.message;
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.panTo(center);
  }, [center.lat, center.lng]);

  useEffect(() => {
    let cancelled = false;
    void loadGoogleMaps()
      .then(() => {
        const map = mapRef.current;
        if (cancelled || !map) return;

        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        const priced = stations
          .map((s) => priceFor(s.id))
          .filter((p): p is number => p !== null)
          .sort((a, b) => a - b);
        const cheapCut = priced.length ? priced[Math.floor(priced.length * 0.34)]! : Infinity;

        // Você está aqui
        markersRef.current.push(
          new google.maps.Marker({
            map,
            position: center,
            title: "Você está aqui",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#1d6fe0",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
            },
          }),
        );

        const known = new Set(
          stations.map((s) => `${s.latitude.toFixed(4)},${s.longitude.toFixed(4)}`),
        );

        osmStations.forEach((s) => {
          if (known.has(`${s.latitude.toFixed(4)},${s.longitude.toFixed(4)}`)) return;
          markersRef.current.push(
            new google.maps.Marker({
              map,
              position: { lat: s.latitude, lng: s.longitude },
              title: `${s.name} · sem preço reportado`,
              icon: pumpIcon("#ffffff", NEUTRAL, 1),
            }),
          );
        });

        stations.forEach((station) => {
          const price = priceFor(station.id);
          const best = station.id === cheapestId;
          const fill = best || (price !== null && price <= cheapCut) ? GREEN : price !== null ? AMBER : "#ffffff";
          const marker = new google.maps.Marker({
            map,
            position: { lat: station.latitude, lng: station.longitude },
            title: `${station.name}${price !== null ? ` · R$ ${formatPrice(price)}` : ""}`,
            zIndex: best ? 999 : 500,
            icon: pumpIcon(fill, "#0f172a", best ? 1.5 : 1.2),
            label:
              price !== null
                ? {
                    text: `R$ ${formatPrice(price)}`,
                    className: "gasopop-map-label",
                    color: "#0f172a",
                    fontSize: "12px",
                    fontWeight: "800",
                  }
                : null,
          });
          marker.addListener("click", () => onSelect(station.id));
          markersRef.current.push(marker);
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [stations, osmStations, center.lat, center.lng, cheapestId, priceFor, onSelect]);

  useEffect(
    () => () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
    },
    [],
  );

  return <div ref={containerRef} className="h-full w-full" />;
}
