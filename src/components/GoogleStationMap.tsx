import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
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

type MapStatus = "loading" | "ready" | "error";
type LeafletApi = typeof import("leaflet");

type LeafletModule = {
  default?: LeafletApi;
};

const leafletPromise = import("leaflet").then((module) => {
  const candidate = module as unknown as LeafletModule;
  return (candidate.default ?? module) as LeafletApi;
});

const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const NEUTRAL = "#94a3b8";
const USER_BLUE = "#1d6fe0";

function priceColor(price: number | null, cheapest: boolean, cheapCut: number) {
  if (cheapest || (price !== null && price <= cheapCut)) return GREEN;
  if (price !== null) return AMBER;
  return "#ffffff";
}

function coordinateKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

function markerIcon(L: LeafletApi, color: string, label?: string) {
  const text = label ? `<span class="gasopop-leaflet-price">${label}</span>` : "";
  return L.divIcon({
    className: "gasopop-leaflet-marker-wrapper",
    html: `<div class="gasopop-leaflet-marker" style="--marker-color:${color}"><span class="gasopop-leaflet-pump">⛽</span></div>${text}`,
    iconSize: label ? [70, 42] : [34, 34],
    iconAnchor: label ? [35, 28] : [17, 17],
  });
}

function addMarkers(
  L: LeafletApi,
  layers: LayerGroup,
  center: Props["center"],
  stations: Station[],
  osmStations: OsmStation[],
  priceFor: Props["priceFor"],
  cheapestId: Props["cheapestId"],
  onSelect: Props["onSelect"],
) {
  layers.clearLayers();

  L.circleMarker([center.lat, center.lng], {
    radius: 9,
    color: "#ffffff",
    weight: 3,
    fillColor: USER_BLUE,
    fillOpacity: 1,
  })
    .bindTooltip("Você está aqui")
    .addTo(layers);

  const priced = stations
    .map((station) => priceFor(station.id))
    .filter((price): price is number => price !== null)
    .sort((a, b) => a - b);
  const cheapCut = priced.length ? priced[Math.floor(priced.length * 0.34)]! : Infinity;
  const known = new Set(
    stations.map((station) => coordinateKey(station.latitude, station.longitude)),
  );

  osmStations.forEach((station) => {
    if (known.has(coordinateKey(station.latitude, station.longitude))) return;
    L.marker([station.latitude, station.longitude], {
      icon: markerIcon(L, NEUTRAL),
    })
      .bindTooltip(`${station.name} · sem preço reportado`)
      .addTo(layers);
  });

  stations.forEach((station) => {
    const price = priceFor(station.id);
    const isCheapest = station.id === cheapestId;
    const label = price !== null ? `R$ ${formatPrice(price)}` : undefined;
    L.marker([station.latitude, station.longitude], {
      icon: markerIcon(L, priceColor(price, isCheapest, cheapCut), label),
      zIndexOffset: isCheapest ? 999 : 500,
    })
      .bindTooltip(`${station.name}${label ? ` · ${label}` : ""}`)
      .on("click", () => onSelect(station.id))
      .addTo(layers);
  });
}

/** Robust browser-only Leaflet map using free OpenStreetMap tiles. */
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
  const [status, setStatus] = useState<MapStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("Não foi possível carregar o mapa.");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    setStatus("loading");
    setErrorMessage("Não foi possível carregar o mapa.");

    void leafletPromise
      .then((L) => {
        if (cancelled || !containerRef.current) return;

        const map = L.map(containerRef.current, {
          center: [center.lat, center.lng],
          zoom: 13,
          minZoom: 3,
          maxZoom: 19,
          zoomControl: false,
          preferCanvas: true,
          attributionControl: true,
        });

        L.control.zoom({ position: "bottomright" }).addTo(map);
        const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          crossOrigin: true,
          keepBuffer: 2,
        }).addTo(map);

        tileLayer.on("tileerror", () => {
          if (!cancelled) {
            setErrorMessage("Os mapas estão demorando para responder. Tente novamente.");
          }
        });

        const layers = L.layerGroup().addTo(map);
        mapRef.current = map;
        layersRef.current = layers;
        setStatus("ready");

        resizeObserver = new ResizeObserver(() => map.invalidateSize({ animate: false }));
        resizeObserver.observe(containerRef.current);
        window.setTimeout(() => map.invalidateSize({ animate: false }), 0);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("[GasoPop] Leaflet failed to load", error);
        setErrorMessage("Não foi possível carregar o mapa. Tente novamente.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      layersRef.current?.clearLayers();
      layersRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The initial center is used only during map creation. Later changes use panTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken]);

  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    mapRef.current.panTo([center.lat, center.lng], { animate: false });
  }, [center.lat, center.lng, status]);

  useEffect(() => {
    if (status !== "ready" || !layersRef.current) return;
    let cancelled = false;

    void leafletPromise.then((L) => {
      if (cancelled || !layersRef.current) return;
      addMarkers(
        L,
        layersRef.current,
        center,
        stations,
        osmStations,
        priceFor,
        cheapestId,
        onSelect,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [status, center, stations, osmStations, priceFor, cheapestId, onSelect]);

  const retry = () => {
    mapRef.current?.remove();
    mapRef.current = null;
    layersRef.current = null;
    setRetryToken((token) => token + 1);
  };

  return (
    <div className="relative h-full w-full bg-muted">
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" ? (
        <div className="gasopop-map-status" role="status">
          <span className="gasopop-map-spinner" />
          Carregando mapa…
        </div>
      ) : null}
      {status === "error" ? (
        <div className="gasopop-map-status gasopop-map-status-error" role="alert">
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-2 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}
    </div>
  );
}
