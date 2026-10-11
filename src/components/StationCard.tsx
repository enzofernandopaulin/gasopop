import { Link } from "@tanstack/react-router";
import { Heart, MapPin } from "lucide-react";
import type { PriceReport, Station } from "@/hooks/useGasoPop";
import { BRAND_LABELS, FUEL_SHORT, formatDistance, formatPrice, isStale, timeAgo } from "@/lib/fuel";
import { cn } from "@/lib/utils";

export function StationCard({
  station,
  report,
  otherReports,
  isFavorite,
  onToggleFavorite,
  highlight,
}: {
  station: Station;
  report: PriceReport | undefined;
  otherReports: PriceReport[];
  isFavorite: boolean;
  onToggleFavorite: () => void;
  highlight?: boolean;
}) {
  const stale = report ? isStale(report.reported_at) : false;

  return (
    <div className={cn("pop-card relative p-4", highlight && "ring-2 ring-primary")}>
      {highlight ? (
        <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-extrabold text-primary-foreground shadow-pop">
          MAIS BARATO
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <Link to="/estacao/$id" params={{ id: station.id }} className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold">{station.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {BRAND_LABELS[station.brand]} · {station.address}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <MapPin className="size-3.5" /> {formatDistance(station.distance_km)}
          </p>
        </Link>

        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar posto"}
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"
        >
          <Heart className={cn("size-5", isFavorite && "fill-destructive text-destructive")} />
        </button>
      </div>

      <Link
        to="/estacao/$id"
        params={{ id: station.id }}
        className="mt-3 flex items-end justify-between gap-3"
      >
        <div className={cn(stale && "opacity-50")}>
          <p className="price-xl">
            <span className="mr-1 align-middle text-base font-bold text-muted-foreground">R$</span>
            {report ? formatPrice(report.price) : "--"}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {report
              ? `${stale ? "desatualizado · " : ""}${timeAgo(report.reported_at)}${
                  report.confirmations > 0 ? ` · ${report.confirmations} confirmações` : ""
                }`
              : "sem preço reportado"}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-1">
          {otherReports.slice(0, 3).map((r) => (
            <span
              key={r.id}
              className="rounded-full bg-secondary px-2 py-1 text-[11px] font-bold text-secondary-foreground"
            >
              {FUEL_SHORT[r.fuel_type]} {formatPrice(r.price)}
            </span>
          ))}
        </div>
      </Link>
    </div>
  );
}
