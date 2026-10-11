import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Brand, FuelType } from "@/lib/fuel";
import { fetchOsmStations } from "@/lib/overpass";

export type Station = {
  id: string;
  name: string;
  brand: Brand;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  distance_km?: number | null;
};

export type PriceReport = {
  id: string;
  station_id: string;
  user_id: string | null;
  fuel_type: FuelType;
  price: number;
  source: "user" | "anp";
  reported_at: string;
  confirmations: number;
};

export type Profile = {
  id: string;
  name: string;
  default_fuel_type: FuelType;
  avg_consumption_kml: number;
  flex_fuel: boolean;
  points: number;
  plan: "free" | "premium";
};

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

export function useNearbyStations(lat: number, lng: number, radiusKm = 25, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["stations", lat.toFixed(3), lng.toFixed(3), radiusKm],
    queryFn: async (): Promise<Station[]> => {
      const { data, error } = await supabase.rpc("nearby_stations", {
        _lat: lat,
        _lng: lng,
        _radius_km: radiusKm,
      });
      if (error) throw error;
      const rows = (data ?? []) as Station[];
      if (rows.length > 0) return rows;

      // Fallback: no station inside the radius, show the closest ones anyway.
      const all = await supabase
        .from("stations")
        .select("id, name, brand, address, city, latitude, longitude");
      if (all.error) throw all.error;
      return ((all.data ?? []) as Station[])
        .map((s) => ({ ...s, distance_km: haversine(lat, lng, s.latitude, s.longitude) }))
        .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
        .slice(0, 30);
    },
  });
}

export function useStation(stationId: string) {
  return useQuery({
    queryKey: ["station", stationId],
    queryFn: async (): Promise<Station | null> => {
      const { data, error } = await supabase
        .from("stations")
        .select("id, name, brand, address, city, latitude, longitude")
        .eq("id", stationId)
        .maybeSingle();
      if (error) throw error;
      return (data as Station) ?? null;
    },
  });
}

/** All reports (with confirmation counts) for the given stations, newest first. */
export function useReports(stationIds: string[]) {
  const key = [...stationIds].sort().join(",");
  return useQuery({
    queryKey: ["reports", key],
    enabled: stationIds.length > 0,
    queryFn: async (): Promise<PriceReport[]> => {
      const { data, error } = await supabase
        .from("price_reports")
        .select("id, station_id, user_id, fuel_type, price, source, reported_at")
        .in("station_id", stationIds)
        .order("reported_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const reports = (data ?? []) as Omit<PriceReport, "confirmations">[];

      const { data: confs } = await supabase
        .from("confirmations")
        .select("price_report_id")
        .in(
          "price_report_id",
          reports.map((r) => r.id),
        );
      const counts = new Map<string, number>();
      ((confs ?? []) as { price_report_id: string }[]).forEach((c) => {
        counts.set(c.price_report_id, (counts.get(c.price_report_id) ?? 0) + 1);
      });

      return reports.map((r) => ({
        ...r,
        price: Number(r.price),
        confirmations: counts.get(r.id) ?? 0,
      }));
    },
  });
}

/** Latest report per station+fuel. */
export function latestByStationFuel(reports: PriceReport[]) {
  const map = new Map<string, PriceReport>();
  reports.forEach((r) => {
    const key = `${r.station_id}:${r.fuel_type}`;
    const existing = map.get(key);
    if (!existing || new Date(r.reported_at) > new Date(existing.reported_at)) {
      map.set(key, r);
    }
  });
  return map;
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, default_fuel_type, avg_consumption_kml, flex_fuel, points, plan")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...(data as Profile), avg_consumption_kml: Number(data.avg_consumption_kml) };
    },
  });
}

export function useFavorites(userId: string | undefined) {
  return useQuery({
    queryKey: ["favorites", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("favorites").select("station_id");
      if (error) throw error;
      return ((data ?? []) as { station_id: string }[]).map((f) => f.station_id);
    },
  });
}

export function useMyConfirmations(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-confirmations", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("confirmations").select("price_report_id");
      if (error) throw error;
      return ((data ?? []) as { price_report_id: string }[]).map((c) => c.price_report_id);
    },
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: async (): Promise<{ id: string; name: string; points: number }[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, points")
        .order("points", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; points: number }[];
    },
  });
}

/** Real fuel stations from OpenStreetMap (Overpass API), for map context. */
export function useOsmStations(lat: number, lng: number, radiusKm = 6, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["osm-stations", lat.toFixed(3), lng.toFixed(3), radiusKm],
    staleTime: 1000 * 60 * 30,
    queryFn: () => fetchOsmStations(lat, lng, radiusKm),
  });
}
