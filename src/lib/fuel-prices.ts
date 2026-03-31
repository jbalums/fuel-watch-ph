import type { FuelType } from "@/types/station";

export const fuelTypes = [
  "Unleaded",
  "Premium",
  "Diesel",
  "Premium Diesel",
] as const satisfies readonly FuelType[];

export const fuelTypeTextColorClassNames: Record<FuelType, string> = {
  Unleaded: "text-green-600",
  Premium: "text-red-600",
  Diesel: "text-amber-600",
  "Premium Diesel": "text-sky-600",
};

export type FuelPriceMap = Record<FuelType, number | null>;
export type FuelPriceFormMap = Record<FuelType, string>;

export function createEmptyFuelPriceMap(): FuelPriceMap {
  return fuelTypes.reduce((prices, fuelType) => {
    prices[fuelType] = null;
    return prices;
  }, {} as FuelPriceMap);
}

export function createEmptyFuelPriceFormMap(): FuelPriceFormMap {
  return fuelTypes.reduce((prices, fuelType) => {
    prices[fuelType] = "";
    return prices;
  }, {} as FuelPriceFormMap);
}

export function normalizeFuelPrices(
  rawPrices: unknown,
  fallbackFuelType?: FuelType,
  fallbackPrice?: number,
): FuelPriceMap {
  const prices = createEmptyFuelPriceMap();

  if (rawPrices && typeof rawPrices === "object" && !Array.isArray(rawPrices)) {
    for (const fuelType of fuelTypes) {
      const value = rawPrices[fuelType as keyof typeof rawPrices];
      prices[fuelType] =
        typeof value === "number"
          ? value
          : typeof value === "string" && value.trim() !== ""
            ? Number(value)
            : null;

      if (prices[fuelType] !== null && Number.isNaN(prices[fuelType])) {
        prices[fuelType] = null;
      }
    }
  }

  if (
    fallbackFuelType &&
    Number.isFinite(fallbackPrice) &&
    (fallbackPrice ?? 0) > 0 &&
    prices[fallbackFuelType] === null
  ) {
    prices[fallbackFuelType] = fallbackPrice ?? null;
  }

  return prices;
}

export function parseFuelPriceForm(
  rawPrices: FuelPriceFormMap,
): FuelPriceMap {
  const prices = createEmptyFuelPriceMap();

  for (const fuelType of fuelTypes) {
    const rawValue = rawPrices[fuelType].trim();
    if (!rawValue) {
      prices[fuelType] = null;
      continue;
    }

    const parsedValue = Number.parseFloat(rawValue);
    if (Number.isNaN(parsedValue)) {
      throw new Error(`${fuelType} price must be a valid number`);
    }

    if (parsedValue <= 0) {
      throw new Error(`${fuelType} price must be greater than 0`);
    }

    prices[fuelType] = parsedValue;
  }

  return prices;
}

export function getPrimaryFuelPriceSelection(prices: FuelPriceMap) {
  let selection: { fuelType: FuelType; price: number } | null = null;

  for (const fuelType of fuelTypes) {
    const price = prices[fuelType];
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      continue;
    }

    if (!selection || price < selection.price) {
      selection = { fuelType, price };
    }
  }

  return selection;
}

export function hasAnyFuelPrice(prices: FuelPriceMap) {
  return fuelTypes.some((fuelType) => {
    const price = prices[fuelType];
    return typeof price === "number" && Number.isFinite(price) && price > 0;
  });
}
