import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FUEL_LABELS, FUEL_TYPES, type FuelType } from "@/lib/fuel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ReportPriceDialog({
  stationId,
  stationName,
  defaultFuel,
  trigger,
}: {
  stationId: string;
  stationName: string;
  defaultFuel: FuelType;
  trigger: React.ReactNode;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fuel, setFuel] = useState<FuelType>(defaultFuel);
  const [price, setPrice] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const value = Number(price.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0 || value > 30) {
        throw new Error("Informe um preço válido, por exemplo 5,79");
      }
      const { error } = await supabase.from("price_reports").insert({
        station_id: stationId,
        user_id: user!.id,
        fuel_type: fuel,
        price: value,
        source: "user",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preço enviado! +10 pontos 🎉");
      setPrice("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Reportar preço</DialogTitle>
          <DialogDescription>{stationName}</DialogDescription>
        </DialogHeader>

        {user ? (
          <div className="space-y-5">
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

            <div className="flex items-center gap-3 rounded-3xl bg-secondary px-5 py-4">
              <span className="font-display text-2xl font-extrabold text-muted-foreground">R$</span>
              <input
                autoFocus
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="5,79"
                aria-label="Preço por litro"
                className="price-xl w-full bg-transparent outline-none placeholder:text-muted-foreground/50"
              />
            </div>

            <Button
              size="lg"
              className="h-14 w-full rounded-2xl text-base font-extrabold"
              disabled={mutation.isPending || price.trim() === ""}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Enviando..." : "Enviar preço"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Entre na sua conta para reportar preços e ganhar pontos.
            </p>
            <Button asChild size="lg" className="h-14 w-full rounded-2xl text-base font-extrabold">
              <Link to="/auth">Entrar no GasoPop</Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
