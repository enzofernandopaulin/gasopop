/** Real fuel stations from OpenStreetMap via the Overpass API. */
export type OsmStation = {
  id: string;
  name: string;
  brand: string | null;
  latitude: number;
  longitude: number;
  distance_km: number;
};

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export async function fetchOsmStations(
  lat: number,
  lng: number,
  radiusKm = 5,
): Promise<OsmStation[]> {
  const radius = Math.round(radiusKm * 1000);
  const query = `[out:json][timeout:20];
(
  node["amenity"="fuel"](around:${radius},${lat},${lng});
  way["amenity"="fuel"](around:${radius},${lat},${lng});
);
out center 60;`;

  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: query,
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return (json.elements ?? [])
        .map((el) => {
          const la = el.lat ?? el.center?.lat;
          const lo = el.lon ?? el.center?.lon;
          if (la === undefined || lo === undefined) return null;
          const tags = el.tags ?? {};
          return {
            id: `osm:${el.type}/${el.id}`,
            name: tags["name"] ?? tags["brand"] ?? tags["operator"] ?? "Posto de combustível",
            brand: tags["brand"] ?? tags["operator"] ?? null,
            latitude: la,
            longitude: lo,
            distance_km: haversine(lat, lng, la, lo),
          } satisfies OsmStation;
        })
        .filter((s): s is OsmStation => s !== null)
        .sort((a, b) => a.distance_km - b.distance_km);
    } catch {
      // try next endpoint
    }
  }
  return [];
}
