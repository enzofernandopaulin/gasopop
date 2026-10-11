import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Heart, MapPin, Navigation, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PriceSparkline } from "@/components/PriceSparkline";
import { ReportPriceDialog } from "@/components/ReportPriceDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  latestByStationFuel,
  useFavorites,
  useMyConfirmations,
  useProfile,
  useReports,
  useStation,
} from "@/hooks/useGasoPop";
import { supabase } from "@/integrations/supabase/client";
import {
  BRAND_LABELS,
  FUEL_LABELS,
  FUEL_TYPES,
  formatPrice,
  isStale,
  timeAgo,
} from "@/lib/fuel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/estacao/$id")({
  head: () => ({
    meta: [
      { title: "Preços do posto | GasoPop" },
      {
        name: "description",
        content:
          "Veja os preços mais recentes deste posto, confirme valores e ajude outros motoristas a economizar.",
      },
      { property: "og:title", content: "Preços do posto | GasoPop" },
      {
        property: "og:description",
        content: "Preços atualizados pela comunidade GasoPop.",
      },
    ],
  }),
  component: StationPage,
});

function StationPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: station, isLoading } = useStation(id);
  const { data: reports } = useReports([id]);
  const { data: favorites } = useFavorites(user?.id);
  const { data: myConfirmations } = useMyConfirmations(user?.id);
  const { data: profile } = useProfile(user?.id);

  const latest = useMemo(() => latestByStationFuel(reports ?? []), [reports]);
  const isFavorite = (favorites ?? []).includes(id);
  const defaultFuel = profile?.default_fuel_type ?? "gasolina_comum";

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre na sua conta para favoritar postos.");
      if (isFavorite) {
        const { error } = await supabase.from("favorites").delete().eq("station_id", id);
        if (error) throw error;
        return "removed" as const;
      }
      const { error } = await supabase
        .from("favorites")
        .insert({ user_id: user.id, station_id: id });
      if (error) throw error;
      return "added" as const;
    },
    onSuccess: (result) => {
      toast.success(result === "added" ? "Posto favoritado ⭐" : "Removido dos favoritos");
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirm = useMutation({
    mutationFn: async (reportId: string) => {
      if (!user) throw new Error("Entre na sua conta para confirmar preços.");
      const { error } = await supabase
        .from("confirmations")
        .insert({ price_report_id: reportId, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preço confirmado! +5 pontos 👏");
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      void queryClient.invalidateQueries({ queryKey: ["my-confirmations"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <AppShell>
        <Skeleton className="h-64 rounded-3xl" />
      </AppShell>
    );
  }

  if (!station) {
    return (
      <AppShell>
        <div className="pop-card p-6 text-center">
          <p className="font-display text-lg font-bold">Posto não encontrado</p>
          <Button asChild className="mt-4 rounded-2xl">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const history = (reports ?? []).slice(0, 12);

  return (
    <AppShell>
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar
      </Link>

      <section className="surface-hero -mx-4 px-4 pb-6 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-extrabold leading-tight">{station.name}</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {BRAND_LABELS[station.brand]}
            </p>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-4" /> {station.address}
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleFavorite.mutate()}
            aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar posto"}
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card shadow-soft"
          >
            <Heart className={cn("size-5", isFavorite && "fill-destructive text-destructive")} />
          </button>
        </div>

        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-card px-4 py-3.5 text-sm font-extrabold shadow-soft"
        >
          <Navigation className="size-4" /> Como chegar
        </a>
      </section>

      <h2 className="mt-6 font-display text-lg font-bold">Preços atuais</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {FUEL_TYPES.map((fuel) => {
          const report = latest.get(`${id}:${fuel}`);
          const stale = report ? isStale(report.reported_at) : false;
          return (
            <div key={fuel} className="pop-card p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                {FUEL_LABELS[fuel]}
              </p>
              <p className={cn("price-lg mt-1", stale && "opacity-50")}>
                <span className="mr-1 text-sm text-muted-foreground">R$</span>
                {report ? formatPrice(report.price) : "--"}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                {report ? timeAgo(report.reported_at) : "sem preço"}
              </p>
              {report ? (
                <button
                  type="button"
                  disabled={
                    confirm.isPending || (myConfirmations ?? []).includes(report.id) || !user
                  }
                  onClick={() => confirm.mutate(report.id)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-extrabold text-secondary-foreground disabled:opacity-50"
                >
                  <Check className="size-3.5" strokeWidth={3} />
                  {(myConfirmations ?? []).includes(report.id)
                    ? "Confirmado"
                    : `Confirmar (${report.confirmations})`}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <h2 className="mt-6 font-display text-lg font-bold">Variação do preço</h2>
      <div className="mt-3">
        <PriceSparkline
          label={FUEL_LABELS[defaultFuel]}
          points={(reports ?? [])
            .filter((r) => r.fuel_type === defaultFuel)
            .slice(0, 20)
            .map((r) => ({ price: r.price, reported_at: r.reported_at }))}
        />
      </div>

      <h2 className="mt-6 font-display text-lg font-bold">Histórico recente</h2>
      <div className="mt-3 space-y-2 pb-6">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não há preços reportados aqui.</p>
        ) : (
          history.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3"
            >
              <div>
                <p className="text-sm font-bold">{FUEL_LABELS[r.fuel_type]}</p>
                <p className="text-xs text-muted-foreground">
                  {timeAgo(r.reported_at)} · {r.source === "anp" ? "ANP" : "comunidade"}
                </p>
              </div>
              <p className="font-display text-lg font-extrabold tabular-nums">
                R$ {formatPrice(r.price)}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="fixed inset-x-0 bottom-20 z-30 mx-auto flex max-w-2xl justify-center px-4">
        <ReportPriceDialog
          stationId={station.id}
          stationName={station.name}
          defaultFuel={defaultFuel}
          trigger={
            <Button size="lg" className="h-14 rounded-full px-7 text-base font-extrabold shadow-float">
              <Plus className="mr-1 size-5" strokeWidth={3} /> Reportar preço
            </Button>
          }
        />
      </div>
    </AppShell>
  );
}
