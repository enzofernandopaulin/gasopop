import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useGasoPop";
import { supabase } from "@/integrations/supabase/client";
import { FUEL_LABELS, FUEL_TYPES, levelFor, type FuelType } from "@/lib/fuel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil | GasoPop" },
      {
        name: "description",
        content:
          "Ajuste o combustível preferido, o consumo do seu carro e acompanhe seus pontos no GasoPop.",
      },
      { property: "og:title", content: "Meu perfil | GasoPop" },
      {
        property: "og:description",
        content: "Seu carro, suas preferências e seus pontos GasoPop.",
      },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useProfile(user?.id);

  const [name, setName] = useState("");
  const [fuel, setFuel] = useState<FuelType>("gasolina_comum");
  const [kml, setKml] = useState("10");
  const [flex, setFlex] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setFuel(profile.default_fuel_type);
    setKml(String(profile.avg_consumption_kml));
    setFlex(profile.flex_fuel);
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const consumption = Number(kml.replace(",", "."));
      if (!Number.isFinite(consumption) || consumption <= 0 || consumption > 60) {
        throw new Error("Informe um consumo válido em km/L, por exemplo 11,5");
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          name,
          default_fuel_type: fuel,
          avg_consumption_kml: consumption,
          flex_fuel: flex,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado 👍");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!user) {
    return (
      <AppShell title="Perfil">
        <div className="pop-card mt-4 p-6 text-center">
          <p className="font-display text-lg font-bold">Entre para personalizar</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Salve o consumo do seu carro e ganhe pontos reportando preços.
          </p>
          <Button asChild size="lg" className="mt-4 h-13 w-full rounded-2xl font-extrabold">
            <Link to="/auth">Entrar no GasoPop</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (isLoading || !profile) {
    return (
      <AppShell title="Perfil">
        <Skeleton className="h-64 rounded-3xl" />
      </AppShell>
    );
  }

  const level = levelFor(profile.points);

  return (
    <AppShell title="Perfil">
      <section className="surface-hero -mx-4 -mt-4 px-4 pb-6 pt-6">
        <p className="text-4xl">{level.badge}</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight">
          {profile.name?.trim() || "Motorista GasoPop"}
        </h1>
        <p className="text-sm font-semibold text-foreground/70">
          Nível {level.level} · {level.name} · {profile.points} pontos
        </p>
        <Progress value={level.progress} className="mt-3 h-2.5" />
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          {level.nextAt
            ? `Faltam ${level.nextAt - profile.points} pontos para o próximo nível`
            : "Nível máximo alcançado!"}
        </p>
      </section>

      <div className="mt-5 space-y-5 pb-6">
        <div className="space-y-1.5">
          <Label htmlFor="perfil-nome">Nome</Label>
          <Input
            id="perfil-nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-13 rounded-2xl"
          />
        </div>

        <div className="space-y-2">
          <Label>Combustível preferido</Label>
          <div className="flex flex-wrap gap-2">
            {FUEL_TYPES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFuel(item)}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-bold",
                  fuel === item
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {FUEL_LABELS[item]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="perfil-kml">Consumo médio com gasolina (km/L)</Label>
          <Input
            id="perfil-kml"
            inputMode="decimal"
            value={kml}
            onChange={(e) => setKml(e.target.value)}
            className="h-13 rounded-2xl"
          />
          <p className="text-xs text-muted-foreground">
            Usado pelo comparador etanol x gasolina.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3.5">
          <div>
            <p className="text-sm font-bold">Carro flex</p>
            <p className="text-xs text-muted-foreground">Aceita etanol e gasolina</p>
          </div>
          <Switch checked={flex} onCheckedChange={setFlex} />
        </div>

        <Button
          size="lg"
          className="h-14 w-full rounded-2xl text-base font-extrabold"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            void navigate({ to: "/" });
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-muted-foreground"
        >
          <LogOut className="size-4" /> Sair da conta
        </button>
      </div>
    </AppShell>
  );
}
