import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { List, Map as MapIcon, Plus, ArrowDownUp } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { FuelChips } from "@/components/FuelChips";
import { StationCard } from "@/components/StationCard";
import { ReportPriceDialog } from "@/components/ReportPriceDialog";
import { LocationFallback, LocationPrompt, MapLoading } from "@/components/LocationGate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import {
  latestByStationFuel,
  useFavorites,
  useNearbyStations,
  useOsmStations,
  useProfile,
  useReports,
} from "@/hooks/useGasoPop";
import { supabase } from "@/integrations/supabase/client";
import type { FuelType } from "@/lib/fuel";
import { FUEL_LABELS } from "@/lib/fuel";
import { cn } from "@/lib/utils";

const StationMap = lazy(() => import("@/components/GoogleStationMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GasoPop — Combustível mais barato perto de você" },
      {
        name: "description",
        content:
          "Preços de combustível atualizados pela comunidade e comparador etanol x gasolina com o consumo real do seu carro.",
      },
      { property: "og:title", content: "GasoPop — Combustível mais barato perto de você" },
      {
        property: "og:description",
        content: "Ache o posto mais barato perto de você e economize em cada litro.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const geo = useGeolocation();
  const hasLoc = geo.coords !== null;
  const lat = geo.coords?.lat ?? 0;
  const lng = geo.coords?.lng ?? 0;

  const [fuel, setFuel] = useState<FuelType>("gasolina_comum");
  const [view, setView] = useState<"map" | "list">("map");
  const [sort, setSort] = useState<"price" | "distance">("price");

  const { data: stations, isLoading } = useNearbyStations(lat, lng, 25, hasLoc);
  const stationIds = useMemo(() => (stations ?? []).map((s) => s.id), [stations]);
  const { data: reports } = useReports(stationIds);
  const { data: favorites } = useFavorites(user?.id);
  const { data: osmStations } = useOsmStations(lat, lng, 6, hasLoc);

  const activeFuel = profile && fuel === "gasolina_comum" ? profile.default_fuel_type : fuel;
  const latest = useMemo(() => latestByStationFuel(reports ?? []), [reports]);

  const priceFor = useCallback(
    (stationId: string) => latest.get(`${stationId}:${activeFuel}`)?.price ?? null,
    [latest, activeFuel],
  );

  const sorted = useMemo(() => {
    const list = [...(stations ?? [])];
    if (sort === "price") {
      list.sort((a, b) => {
        const pa = priceFor(a.id);
        const pb = priceFor(b.id);
        if (pa === null) return 1;
        if (pb === null) return -1;
        return pa - pb;
      });
    } else {
      list.sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
    }
    return list;
  }, [stations, sort, priceFor]);

  const cheapest = useMemo(() => {
    const withPrice = (stations ?? []).filter((s) => priceFor(s.id) !== null);
    if (withPrice.length === 0) return null;
    return withPrice.reduce((best, s) => (priceFor(s.id)! < priceFor(best.id)! ? s : best));
  }, [stations, priceFor]);

  const toggleFavorite = useMutation({
    mutationFn: async (stationId: string) => {
      if (!user) throw new Error("Entre na sua conta para favoritar postos.");
      if ((favorites ?? []).includes(stationId)) {
        const { error } = await supabase.from("favorites").delete().eq("station_id", stationId);
        if (error) throw error;
        return "removed" as const;
      }
      const { error } = await supabase
        .from("favorites")
        .insert({ user_id: user.id, station_id: stationId });
      if (error) throw error;
      return "added" as const;
    },
    onSuccess: (result) => {
      toast.success(result === "added" ? "Posto favoritado ⭐" : "Removido dos favoritos");
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell>
      <section className="surface-hero -mx-4 -mt-4 px-4 pb-5 pt-6">
        <h1 className="font-display text-3xl font-extrabold leading-tight">
          O litro mais barato,
          <br />
          agora mesmo.
        </h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          {geo.status === "granted" ? "Postos perto de você" : geo.status === "manual" ? "Postos perto do local escolhido" : "Aguardando sua localização"} ·{" "}
          {FUEL_LABELS[activeFuel]}
        </p>

        {cheapest ? (
          <button
            type="button"
            onClick={() => void navigate({ to: "/estacao/$id", params: { id: cheapest.id } })}
            className="mt-4 flex w-full items-center justify-between rounded-3xl bg-card p-4 text-left shadow-float"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary">
                Melhor preço agora
              </p>
              <p className="truncate font-display text-lg font-bold">{cheapest.name}</p>
              <p className="text-xs font-semibold text-muted-foreground">
                {cheapest.distance_km ? `${cheapest.distance_km.toFixed(1)} km de você` : ""}
              </p>
            </div>
            <p className="price-lg shrink-0 text-primary">
              <span className="mr-1 text-sm text-muted-foreground">R$</span>
              {priceFor(cheapest.id)!.toFixed(2).replace(".", ",")}
            </p>
          </button>
        ) : null}
      </section>

      <div className="mt-4 space-y-3">
        <FuelChips value={activeFuel} onChange={setFuel} />

        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-secondary p-1">
            {(
              [
                ["map", MapIcon, "Mapa"],
                ["list", List, "Lista"],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold",
                  view === key ? "bg-card shadow-soft" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSort(sort === "price" ? "distance" : "price")}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-sm font-bold"
          >
            <ArrowDownUp className="size-4" />
            {sort === "price" ? "Preço" : "Distância"}
          </button>
        </div>

        {["denied", "unsupported", "manual"].includes(geo.status) ? (
          <LocationFallback geo={geo} />
        ) : null}

        {view === "map" ? (
          <div className="h-[420px] overflow-hidden rounded-3xl border border-border shadow-soft">
            {geo.status === "prompt" ? (
              <LocationPrompt geo={geo} />
            ) : !geo.coords ? (
              <MapLoading
                text={
                  geo.status === "asking"
                    ? "Aguardando você permitir a localização…"
                    : geo.status === "checking"
                      ? "Verificando localização…"
                      : "Digite uma cidade ou endereço para ver o mapa."
                }
              />
            ) : (
            <ClientOnly fallback={<Skeleton className="h-full w-full" />}>
              <Suspense fallback={<Skeleton className="h-full w-full" />}>
                <StationMap
                  center={{ lat, lng }}
                  stations={stations ?? []}
                  osmStations={osmStations ?? []}
                  priceFor={priceFor}
                  cheapestId={cheapest?.id ?? null}
                  onSelect={(id) => void navigate({ to: "/estacao/$id", params: { id } })}
                />
              </Suspense>
            </ClientOnly>
            )}
          </div>
        ) : null}

        <div className="space-y-3 pb-4">
          {!hasLoc ? null : isLoading
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-3xl" />)
            : sorted.map((station) => (
                <StationCard
                  key={station.id}
                  station={station}
                  report={latest.get(`${station.id}:${activeFuel}`)}
                  otherReports={(reports ?? []).filter(
                    (r) => r.station_id === station.id && r.fuel_type !== activeFuel,
                  )}
                  isFavorite={(favorites ?? []).includes(station.id)}
                  onToggleFavorite={() => toggleFavorite.mutate(station.id)}
                  highlight={station.id === cheapest?.id}
                />
              ))}
        </div>
      </div>

      {sorted.length > 0 ? (
        <div className="fixed inset-x-0 bottom-20 z-30 mx-auto flex max-w-2xl justify-center px-4">
          <ReportPriceDialog
            stationId={sorted[0]!.id}
            stationName={sorted[0]!.name}
            defaultFuel={activeFuel}
            trigger={
              <Button
                size="lg"
                className="h-14 rounded-full px-7 text-base font-extrabold shadow-float"
              >
                <Plus className="mr-1 size-5" strokeWidth={3} /> Reportar preço
              </Button>
            }
          />
        </div>
      ) : null}
    </AppShell>
  );
}
