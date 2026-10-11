import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LocateFixed, MapPin, Search, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import type { GeoState } from "@/hooks/useGeolocation";
import { geocodeAddress } from "@/lib/geocode.functions";

/** Explanation shown BEFORE the native permission popup. */
export function LocationPrompt({ geo }: { geo: GeoState }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-card p-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-pop">
        <MapPin className="size-8" strokeWidth={2.6} />
      </span>
      <div>
        <p className="font-display text-xl font-extrabold">Onde você está?</p>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          GasoPop precisa da sua localização para mostrar os postos mais baratos perto de você.
        </p>
      </div>
      <Button size="lg" className="h-14 rounded-full px-7 text-base font-extrabold" onClick={geo.request}>
        <LocateFixed className="mr-1 size-5" /> Permitir localização
      </Button>
    </div>
  );
}

export function MapLoading({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-secondary/60 text-center">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="px-6 text-sm font-bold text-muted-foreground">{text}</p>
    </div>
  );
}

/** Non-blocking banner for denied / unsupported / manual states. */
export function LocationFallback({ geo }: { geo: GeoState }) {
  const { user } = useAuth();
  const geocode = useServerFn(geocodeAddress);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setBusy(true);
    try {
      geo.setManual(await geocode({ data: { query } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível buscar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-3xl border border-accent/40 bg-accent/10 p-4">
      <p className="text-sm font-bold">
        {geo.status === "unsupported"
          ? "Seu navegador não informa a localização. Digite sua cidade ou endereço:"
          : geo.status === "manual"
            ? `Mostrando postos perto de: ${geo.coords?.label ?? "local escolhido"}`
            : "Sem a sua localização os resultados ficam menos precisos. Digite uma cidade ou endereço:"}
      </p>

      {user ? (
        <form onSubmit={search} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: Av. Paulista, São Paulo"
            maxLength={160}
            className="h-12 rounded-2xl bg-card"
          />
          <Button type="submit" className="h-12 rounded-2xl px-4" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          </Button>
        </form>
      ) : (
        <p className="text-sm font-semibold text-muted-foreground">
          <Link to="/auth" className="font-extrabold text-primary underline">
            Entre na sua conta
          </Link>{" "}
          para buscar por cidade ou endereço.
        </p>
      )}

      {geo.status !== "unsupported" ? (
        geo.previouslyDenied ? (
          <div>
            <Button variant="secondary" className="h-11 rounded-full font-bold" onClick={() => setShowHelp((v) => !v)}>
              <Settings className="mr-1 size-4" /> Ativar localização
            </Button>
            {showHelp ? (
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm font-semibold text-muted-foreground">
                <li>Toque no ícone de cadeado (ou "i") ao lado do endereço do site.</li>
                <li>Abra "Permissões" ou "Configurações do site".</li>
                <li>Em "Localização", escolha "Permitir".</li>
                <li>Recarregue a página.</li>
                <li>No celular, confira também se a localização do aparelho está ligada.</li>
              </ol>
            ) : null}
          </div>
        ) : (
          <Button variant="secondary" className="h-11 rounded-full font-bold" onClick={geo.request}>
            <LocateFixed className="mr-1 size-4" /> Tentar usar minha localização
          </Button>
        )
      ) : null}
    </div>
  );
}
