import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Droplets, Fuel } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useGasoPop";
import { compareFuels, formatBRL } from "@/lib/fuel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/comparador")({
  head: () => ({
    meta: [
      { title: "Etanol ou gasolina? | GasoPop" },
      {
        name: "description",
        content:
          "Compare etanol e gasolina usando o consumo real do seu carro e descubra qual compensa hoje.",
      },
      { property: "og:title", content: "Etanol ou gasolina? | GasoPop" },
      {
        property: "og:description",
        content: "O comparador que usa o km/L do seu carro, não a regra dos 70%.",
      },
    ],
  }),
  component: Comparador,
});

function PriceField({
  label,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: typeof Fuel;
}) {
  return (
    <div className="pop-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-lg font-extrabold text-muted-foreground">R$</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="price-lg w-full bg-transparent outline-none placeholder:text-muted-foreground/40"
          placeholder="0,00"
        />
      </div>
    </div>
  );
}

function Comparador() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);

  const [gas, setGas] = useState("5,89");
  const [eth, setEth] = useState("3,99");
  const [kml, setKml] = useState<number | null>(null);

  const consumption = kml ?? profile?.avg_consumption_kml ?? 10;
  const gasPrice = Number(gas.replace(",", "."));
  const ethPrice = Number(eth.replace(",", "."));
  const valid = Number.isFinite(gasPrice) && Number.isFinite(ethPrice) && gasPrice > 0 && ethPrice > 0;

  const result = useMemo(
    () => (valid ? compareFuels(gasPrice, ethPrice, consumption) : null),
    [valid, gasPrice, ethPrice, consumption],
  );

  return (
    <AppShell title="Comparador" subtitle="Etanol x gasolina">
      <section className="surface-hero -mx-4 -mt-4 px-4 pb-5 pt-6">
        <h1 className="font-display text-3xl font-extrabold leading-tight">
          Etanol ou gasolina
          <br />
          para o SEU carro?
        </h1>
        <p className="mt-1 text-sm font-semibold text-foreground/70">
          Usamos o consumo real do seu veículo, não a regra dos 70%.
        </p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <PriceField label="Gasolina" value={gas} onChange={setGas} icon={Fuel} />
        <PriceField label="Etanol" value={eth} onChange={setEth} icon={Droplets} />
      </div>

      <div className="pop-card mt-3 p-5">
        <div className="flex items-baseline justify-between">
          <Label className="text-sm font-bold">Consumo com gasolina</Label>
          <span className="font-display text-xl font-extrabold tabular-nums">
            {consumption.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km/L
          </span>
        </div>
        <Slider
          className="mt-4"
          value={[consumption]}
          min={4}
          max={25}
          step={0.5}
          onValueChange={([v]) => setKml(v ?? 10)}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Ajuste conforme o seu carro — quanto mais preciso, melhor a recomendação.
        </p>
      </div>

      {result ? (
        <div
          className={cn(
            "mt-4 rounded-3xl p-6 text-center shadow-float",
            result.winner === "etanol" ? "bg-primary text-primary-foreground" : "bg-card",
          )}
        >
          <p className="text-xs font-extrabold uppercase tracking-widest opacity-80">
            Recomendação de hoje
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold">{result.headline}</p>
          <p className="mt-2 text-sm font-semibold opacity-90">{result.detail}</p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl bg-background/70 p-3 text-foreground">
              <p className="text-[11px] font-extrabold uppercase text-muted-foreground">
                Custo/km etanol
              </p>
              <p className="font-display text-xl font-extrabold tabular-nums">
                {formatBRL(result.costPerKmEtanol)}
              </p>
            </div>
            <div className="rounded-2xl bg-background/70 p-3 text-foreground">
              <p className="text-[11px] font-extrabold uppercase text-muted-foreground">
                Custo/km gasolina
              </p>
              <p className="font-display text-xl font-extrabold tabular-nums">
                {formatBRL(result.costPerKmGasolina)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Informe os dois preços para comparar.</p>
      )}
    </AppShell>
  );
}
