import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { latestByStationFuel, useFavorites, useProfile, useReports } from "@/hooks/useGasoPop";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/fuel";

const STORAGE_KEY = "gasopop:fav-prices";

type Snapshot = Record<string, number>;

function readSnapshot(): Snapshot {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Snapshot;
  } catch {
    return {};
  }
}

/**
 * In-app alert: when the price of a favorited station drops since the last
 * time this device saw it, show a toast.
 */
export function usePriceAlerts() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: favorites } = useFavorites(user?.id);
  const { data: reports } = useReports(favorites ?? []);
  const notified = useRef(new Set<string>());

  useEffect(() => {
    if (!favorites?.length || !reports?.length) return;
    const fuel = profile?.default_fuel_type ?? "gasolina_comum";
    const latest = latestByStationFuel(reports);
    const previous = readSnapshot();
    const next: Snapshot = { ...previous };

    favorites.forEach((stationId) => {
      const report = latest.get(`${stationId}:${fuel}`);
      if (!report) return;
      const before = previous[stationId];
      if (before !== undefined && report.price < before - 0.009 && !notified.current.has(report.id)) {
        notified.current.add(report.id);
        toast.success("Baixou o preço num favorito! 🎉", {
          description: `R$ ${formatPrice(before)} → R$ ${formatPrice(report.price)}`,
        });
      }
      next[stationId] = report.price;
    });

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable, alerts simply won't persist
    }
  }, [favorites, reports, profile?.default_fuel_type]);
}
