import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

/** Turns a typed city/address into coordinates (Brazil only). Requires login to bound costs. */
export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(2).max(160) }).parse(d))
  .handler(async ({ data }) => {
    const lovable = process.env['LOVABLE_API_KEY'];
    const maps = process.env['GOOGLE_MAPS_API_KEY'];
    if (!lovable || !maps) throw new Error("Busca por endereço indisponível no momento.");
    const res = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?region=br&components=country:BR&language=pt-BR&address=${encodeURIComponent(data.query)}`,
      { headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": maps } },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`Geocode failed [${res.status}]: ${body}`);
      throw new Error(`Falha na busca de endereço [${res.status}]`);
    }
    const json = (await res.json()) as {
      status: string;
      results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
    };
    const first = json.results?.[0];
    if (json.status !== "OK" || !first) throw new Error("Endereço não encontrado. Tente outra cidade.");
    return { lat: first.geometry.location.lat, lng: first.geometry.location.lng, label: first.formatted_address };
  });
