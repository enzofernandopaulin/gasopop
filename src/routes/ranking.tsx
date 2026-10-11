import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard } from "@/hooks/useGasoPop";
import { levelFor } from "@/lib/fuel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking da comunidade | GasoPop" },
      {
        name: "description",
        content:
          "Veja quem mais ajuda motoristas a economizar reportando e confirmando preços no GasoPop.",
      },
      { property: "og:title", content: "Ranking da comunidade | GasoPop" },
      {
        property: "og:description",
        content: "Ganhe pontos reportando preços e suba no ranking do GasoPop.",
      },
    ],
  }),
  component: Ranking,
});

function Ranking() {
  const { user } = useAuth();
  const { data: board, isLoading } = useLeaderboard();

  return (
    <AppShell title="Ranking">
      <section className="surface-hero -mx-4 -mt-4 px-4 pb-5 pt-6">
        <h1 className="font-display text-3xl font-extrabold leading-tight">
          Quem mais ajuda
          <br />a comunidade
        </h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          +10 pontos por preço reportado · +5 por confirmação
        </p>
      </section>

      <div className="mt-4 space-y-2 pb-4">
        {isLoading
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
          : (board ?? []).map((row, index) => {
              const level = levelFor(row.points);
              const me = row.id === user?.id;
              return (
                <div
                  key={row.id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3",
                    me ? "bg-primary text-primary-foreground shadow-pop" : "bg-secondary",
                  )}
                >
                  <span className="w-7 shrink-0 text-center font-display text-lg font-extrabold tabular-nums">
                    {index === 0 ? <Trophy className="mx-auto size-5" /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">
                      {row.name?.trim() || "Motorista GasoPop"} {me ? "(você)" : ""}
                    </p>
                    <p className="truncate text-xs font-semibold opacity-80">
                      {level.badge} {level.name}
                    </p>
                  </div>
                  <span className="font-display text-lg font-extrabold tabular-nums">
                    {row.points}
                  </span>
                </div>
              );
            })}
        {!isLoading && (board ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            O ranking aparece assim que a comunidade começar a reportar preços.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
