import { Link } from "@tanstack/react-router";
import { Fuel, Home, Heart, Trophy, User, Calculator } from "lucide-react";
import type { ReactNode } from "react";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";

const NAV = [
  { to: "/", label: "Início", icon: Home },
  { to: "/comparador", label: "Comparar", icon: Calculator },
  { to: "/favoritos", label: "Favoritos", icon: Heart },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  usePriceAlerts();
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
              <Fuel className="size-5" strokeWidth={2.6} />
            </span>
            <span className="font-display text-xl font-extrabold tracking-tight">GasoPop</span>
          </Link>
          {title ? (
            <div className="text-right">
              <p className="font-display text-sm font-bold leading-tight">{title}</p>
              {subtitle ? (
                <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-stretch justify-between px-2 py-1.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex min-w-16 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold text-muted-foreground transition-colors"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              <Icon className="size-5" strokeWidth={2.3} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
