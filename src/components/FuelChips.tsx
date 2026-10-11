import { FUEL_SHORT, FUEL_TYPES, type FuelType } from "@/lib/fuel";
import { cn } from "@/lib/utils";

export function FuelChips({
  value,
  onChange,
}: {
  value: FuelType;
  onChange: (fuel: FuelType) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {FUEL_TYPES.map((fuel) => (
        <button
          key={fuel}
          type="button"
          onClick={() => onChange(fuel)}
          className={cn(
            "shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition-all",
            value === fuel
              ? "bg-primary text-primary-foreground shadow-pop"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          {FUEL_SHORT[fuel]}
        </button>
      ))}
    </div>
  );
}
