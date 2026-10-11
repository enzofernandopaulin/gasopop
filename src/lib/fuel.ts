export const FUEL_TYPES = [
  "gasolina_comum",
  "gasolina_aditivada",
  "etanol",
  "diesel_s10",
  "diesel_comum",
  "gnv",
] as const;

export type FuelType = (typeof FUEL_TYPES)[number];

export const FUEL_LABELS: Record<FuelType, string> = {
  gasolina_comum: "Gasolina comum",
  gasolina_aditivada: "Gasolina aditivada",
  etanol: "Etanol",
  diesel_s10: "Diesel S10",
  diesel_comum: "Diesel comum",
  gnv: "GNV",
};

export const FUEL_SHORT: Record<FuelType, string> = {
  gasolina_comum: "Comum",
  gasolina_aditivada: "Aditivada",
  etanol: "Etanol",
  diesel_s10: "S10",
  diesel_comum: "Diesel",
  gnv: "GNV",
};

export const BRANDS = [
  "petrobras",
  "shell",
  "ipiranga",
  "raizen",
  "bandeira_branca",
  "outra",
] as const;

export type Brand = (typeof BRANDS)[number];

export const BRAND_LABELS: Record<Brand, string> = {
  petrobras: "Petrobras BR",
  shell: "Shell",
  ipiranga: "Ipiranga",
  raizen: "Raízen",
  bandeira_branca: "Bandeira branca",
  outra: "Outra",
};

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDistance(km: number | null | undefined): string {
  if (km === null || km === undefined) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "há 1 dia";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "há 1 mês" : `há ${months} meses`;
}

/** A report older than 24h is considered stale and gets visually de-emphasized. */
export function isStale(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > 24 * 3600 * 1000;
}

export type Recommendation = {
  winner: "etanol" | "gasolina";
  headline: string;
  detail: string;
  costPerKmEtanol: number;
  costPerKmGasolina: number;
  savingsPer100Km: number;
};

/**
 * Ethanol vs gasoline using the driver's OWN consumption.
 * Ethanol typically yields ~70% of gasoline's km/L, so we scale the
 * driver's gasoline consumption for the ethanol side.
 */
export const ETHANOL_EFFICIENCY_RATIO = 0.7;

export function compareFuels(
  gasPrice: number,
  ethanolPrice: number,
  gasKml: number,
): Recommendation {
  const ethanolKml = gasKml * ETHANOL_EFFICIENCY_RATIO;
  const costPerKmGasolina = gasPrice / gasKml;
  const costPerKmEtanol = ethanolPrice / ethanolKml;
  const winner = costPerKmEtanol < costPerKmGasolina ? "etanol" : "gasolina";
  const diff = Math.abs(costPerKmEtanol - costPerKmGasolina);
  const savingsPer100Km = diff * 100;

  return {
    winner,
    headline: winner === "etanol" ? "Abasteça com etanol" : "Abasteça com gasolina",
    detail:
      savingsPer100Km < 0.5
        ? "A diferença é mínima: vale abastecer o que for mais prático."
        : `Você economiza ${formatBRL(savingsPer100Km)} a cada 100 km rodados.`,
    costPerKmEtanol,
    costPerKmGasolina,
    savingsPer100Km,
  };
}

export function levelFor(points: number) {
  const levels = [
    { min: 0, name: "Calouro do posto", badge: "🚗" },
    { min: 50, name: "Olheiro de bomba", badge: "⛽" },
    { min: 150, name: "Caçador de centavos", badge: "🪙" },
    { min: 400, name: "Radar de preço", badge: "📡" },
    { min: 900, name: "Lenda do GasoPop", badge: "🏆" },
  ];
  let current = levels[0]!;
  let index = 0;
  levels.forEach((lvl, i) => {
    if (points >= lvl.min) {
      current = lvl;
      index = i;
    }
  });
  const next = levels[index + 1];
  return {
    name: current.name,
    badge: current.badge,
    level: index + 1,
    nextAt: next?.min ?? null,
    progress: next ? Math.min(100, ((points - current.min) / (next.min - current.min)) * 100) : 100,
  };
}
