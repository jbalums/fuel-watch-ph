import type {
	FuelAvailabilityMap,
	FuelType,
	StationStatus,
} from "@/types/station";

export const fuelTypes = [
	"Unleaded",
	"Premium",
	"Diesel",
	"Premium Diesel",
	"Kerosene",
] as const satisfies readonly FuelType[];

export const fuelTypeTextColorClassNames: Record<FuelType, string> = {
	Unleaded: "text-green-700 dark:text-green-600",
	Premium: "text-red-700 dark:text-red-600",
	Diesel: "text-amber-700 dark:text-amber-600",
	"Premium Diesel": "text-blue-700 dark:text-sky-600",
	Kerosene: "text-violet-700 dark:text-violet-600",
};
export const fuelTypeBorderColorClassNames: Record<FuelType, string> = {
	Unleaded: "border-green-600",
	Premium: "border-red-600",
	Diesel: "border-amber-600",
	"Premium Diesel": "border-blue-600 dark:border-sky-400",
	Kerosene: "border-violet-600 dark:border-violet-400",
};

export const stationStatuses = [
	"Available",
	"Low",
	"Out",
] as const satisfies readonly StationStatus[];

export type FuelPriceMap = Record<FuelType, number | null>;
export type FuelPriceFormMap = Record<FuelType, string>;
export type FuelAvailabilityFormValue = StationStatus | "";
export type FuelAvailabilityFormMap = Record<
	FuelType,
	FuelAvailabilityFormValue
>;

export function createEmptyFuelPriceMap(): FuelPriceMap {
	return fuelTypes.reduce((prices, fuelType) => {
		prices[fuelType] = null;
		return prices;
	}, {} as FuelPriceMap);
}

export function createEmptyFuelAvailabilityMap(): FuelAvailabilityMap {
	return fuelTypes.reduce((availability, fuelType) => {
		availability[fuelType] = null;
		return availability;
	}, {} as FuelAvailabilityMap);
}

export function createEmptyFuelPriceFormMap(): FuelPriceFormMap {
	return fuelTypes.reduce((prices, fuelType) => {
		prices[fuelType] = "";
		return prices;
	}, {} as FuelPriceFormMap);
}

export function createEmptyFuelAvailabilityFormMap(): FuelAvailabilityFormMap {
	return fuelTypes.reduce((availability, fuelType) => {
		availability[fuelType] = "";
		return availability;
	}, {} as FuelAvailabilityFormMap);
}

export function normalizeFuelPrices(
	rawPrices: unknown,
	fallbackFuelType?: FuelType,
	fallbackPrice?: number,
): FuelPriceMap {
	const prices = createEmptyFuelPriceMap();

	if (
		rawPrices &&
		typeof rawPrices === "object" &&
		!Array.isArray(rawPrices)
	) {
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

export function normalizeFuelAvailability(
	rawAvailability: unknown,
	fallbackFuelType?: FuelType,
	fallbackStatus?: StationStatus,
): FuelAvailabilityMap {
	const availability = createEmptyFuelAvailabilityMap();

	if (
		rawAvailability &&
		typeof rawAvailability === "object" &&
		!Array.isArray(rawAvailability)
	) {
		for (const fuelType of fuelTypes) {
			const value =
				rawAvailability[fuelType as keyof typeof rawAvailability];
			availability[fuelType] =
				typeof value === "string" &&
				stationStatuses.includes(value as StationStatus)
					? (value as StationStatus)
					: null;
		}
	}

	if (
		fallbackFuelType &&
		fallbackStatus &&
		stationStatuses.includes(fallbackStatus) &&
		availability[fallbackFuelType] === null
	) {
		availability[fallbackFuelType] = fallbackStatus;
	}

	return availability;
}

export function parseFuelPriceForm(rawPrices: FuelPriceFormMap): FuelPriceMap {
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

export function parseFuelAvailabilityForm(
	rawAvailability: FuelAvailabilityFormMap,
): FuelAvailabilityMap {
	const availability = createEmptyFuelAvailabilityMap();

	for (const fuelType of fuelTypes) {
		const value = rawAvailability[fuelType];
		availability[fuelType] =
			value && stationStatuses.includes(value) ? value : null;
	}

	return availability;
}

export function isFuelSellable(
	status: StationStatus | null | undefined,
): status is Extract<StationStatus, "Available" | "Low"> {
	return status === "Available" || status === "Low";
}

export function validateFuelPriceAvailability(
	prices: FuelPriceMap,
	fuelAvailability: FuelAvailabilityMap,
) {
	for (const fuelType of fuelTypes) {
		const price = prices[fuelType];
		const status = fuelAvailability[fuelType];

		if (isFuelSellable(status)) {
			if (
				typeof price !== "number" ||
				!Number.isFinite(price) ||
				price <= 0
			) {
				throw new Error(
					`${fuelType} must have a valid price when marked ${status}`,
				);
			}

			continue;
		}

		if (status === "Out") {
			if (price !== null) {
				throw new Error(
					`${fuelType} must not have a price when marked Out`,
				);
			}

			continue;
		}

		if (price !== null) {
			throw new Error(
				`Select an availability for ${fuelType} when a price is entered`,
			);
		}
	}
}

export function getPrimaryFuelPriceSelection(
	prices: FuelPriceMap,
	fuelAvailability?: FuelAvailabilityMap | null,
) {
	let selection: { fuelType: FuelType; price: number } | null = null;

	for (const fuelType of fuelTypes) {
		const price = prices[fuelType];
		const status = fuelAvailability?.[fuelType] ?? null;

		if (fuelAvailability && !isFuelSellable(status)) {
			continue;
		}

		if (
			typeof price !== "number" ||
			!Number.isFinite(price) ||
			price <= 0
		) {
			continue;
		}

		if (!selection || price < selection.price) {
			selection = { fuelType, price };
		}
	}

	return selection;
}

export function getFuelSummarySelection(
	prices: FuelPriceMap,
	fuelAvailability: FuelAvailabilityMap,
	fallbackFuelType?: FuelType,
) {
	const primarySelection = getPrimaryFuelPriceSelection(
		prices,
		fuelAvailability,
	);
	if (primarySelection) {
		return {
			...primarySelection,
			status: fuelAvailability[primarySelection.fuelType] ?? "Available",
		};
	}

	const fallbackOrder = [
		...(fallbackFuelType ? [fallbackFuelType] : []),
		...fuelTypes,
	].filter(
		(fuelType, index, array) => array.indexOf(fuelType) === index,
	) as FuelType[];

	for (const fuelType of fallbackOrder) {
		const status = fuelAvailability[fuelType];
		if (!status) {
			continue;
		}

		return {
			fuelType,
			price: prices[fuelType] ?? 0,
			status,
		};
	}

	return null;
}

export function hasAnyFuelPrice(prices: FuelPriceMap) {
	return fuelTypes.some((fuelType) => {
		const price = prices[fuelType];
		return typeof price === "number" && Number.isFinite(price) && price > 0;
	});
}

export function hasAnyFuelAvailability(availability: FuelAvailabilityMap) {
	return fuelTypes.some((fuelType) => availability[fuelType] !== null);
}
