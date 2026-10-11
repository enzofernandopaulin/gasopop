import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StationCard } from "@/components/StationCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import {
  latestByStationFuel,
  useFavorites,
  useNearbyStations,
  useProfile,
  useReports,
} from "@/hooks/useGasoPop";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/favoritos")({
  head: () => ({
    meta: [
      { title: "Meus postos favoritos | GasoPop" },
      {
        name: "description",
        content: "Acompanhe os preços dos postos que você salvou no GasoPop.",
      },
      { property: "og:title", content: "Meus postos favoritos | GasoPop" },
      {
        property: "og:description",
        content: "Seus postos de confiança e os preços mais recentes deles.",
      },
    ],
  }),
  component: Favoritos,
});

function Favoritos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const geo = useGeolocation();
  const { data: profile } = useProfile(user?.id);
  const { data: favorites, isLoading } = useFavorites(user?.id);
  const { data: stations } = useNearbyStations(geo.coords?.lat ?? -15.78, geo.coords?.lng ?? -47.93, 3000);

  const fuel = profile?.default_fuel_type ?? "gasolina_comum";
  const favStations = useMemo(
    () => (stations ?? []).filter((s) => (favorites ?? []).includes(s.id)),
    [stations, favorites],
  );
  const { data: reports } = useReports(favStations.map((s) => s.id));
  const latest = useMemo(() => latestByStationFuel(reports ?? []), [reports]);

  const remove = useMutation({
    mutationFn: async (stationId: string) => {
      const { error } = await supabase.from("favorites").delete().eq("station_id", stationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido dos favoritos");
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Favoritos">
      <h1 className="font-display text-3xl font-extrabold leading-tight">Seus postos</h1>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        Os lugares onde você costuma abastecer.
      </p>

      {!user ? (
        <div className="pop-card mt-5 p-6 text-center">
          <Heart className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-display text-lg font-bold">Entre para salvar postos</p>
          <Button asChild size="lg" className="mt-4 h-13 w-full rounded-2xl font-extrabold">
            <Link to="/auth">Entrar no GasoPop</Link>
          </Button>
        </div>
      ) : isLoading ? (
        <Skeleton className="mt-5 h-32 rounded-3xl" />
      ) : favStations.length === 0 ? (
        <div className="pop-card mt-5 p-6 text-center">
          <p className="font-display text-lg font-bold">Nenhum favorito ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Toque no coração de um posto para salvá-lo aqui.
          </p>
          <Button asChild size="lg" className="mt-4 h-13 w-full rounded-2xl font-extrabold">
            <Link to="/">Ver postos perto de mim</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-3 pb-4">
          {favStations.map((station) => (
            <StationCard
              key={station.id}
              station={station}
              report={latest.get(`${station.id}:${fuel}`)}
              otherReports={(reports ?? []).filter(
                (r) => r.station_id === station.id && r.fuel_type !== fuel,
              )}
              isFavorite
              onToggleFavorite={() => remove.mutate(station.id)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
