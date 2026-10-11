import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Fuel } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar no GasoPop" },
      {
        name: "description",
        content: "Crie sua conta GasoPop para reportar preços, ganhar pontos e salvar postos.",
      },
      { property: "og:title", content: "Entrar no GasoPop" },
      {
        property: "og:description",
        content: "Crie sua conta e comece a economizar em cada litro.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) void navigate({ to: "/" });
  }, [user, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Bem-vindo ao GasoPop 🎉");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Boas-vindas de volta!");
      }
      void navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
            <Fuel className="size-6" strokeWidth={2.6} />
          </span>
          <span className="font-display text-2xl font-extrabold tracking-tight">GasoPop</span>
        </Link>

        <h1 className="mt-6 font-display text-3xl font-extrabold leading-tight">
          {mode === "signin" ? "Entre e economize" : "Crie sua conta grátis"}
        </h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Reporte preços, ganhe pontos e ache o litro mais barato.
        </p>

        <div className="mt-6 flex rounded-full bg-secondary p-1">
          {(
            [
              ["signin", "Entrar"],
              ["signup", "Criar conta"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={cn(
                "flex-1 rounded-full px-4 py-2.5 text-sm font-bold",
                mode === key ? "bg-card shadow-soft" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === "signup" ? (
            <div className="space-y-1.5">
              <Label htmlFor="name">Seu nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ana Motorista"
                className="h-13 rounded-2xl"
                required
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="h-13 rounded-2xl"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-13 rounded-2xl"
              minLength={6}
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="h-14 w-full rounded-2xl text-base font-extrabold"
          >
            {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <Link
          to="/"
          className="mt-5 block text-center text-sm font-bold text-muted-foreground underline-offset-4 hover:underline"
        >
          Continuar sem conta
        </Link>
      </div>
    </div>
  );
}
