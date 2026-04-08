import { formatDistanceToNow } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import {
	createEmptyFuelPriceMap,
	getFuelSummarySelection,
	fuelTypes,
	normalizeFuelAvailability,
	normalizeFuelPrices,
	stationStatuses,
} from "@/lib/fuel-prices";
import type { FuelType, GasStation, PublicStationSummary } from "@/types/station";

function safeNumber(value: unknown) {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value === "string" && value.trim() !== "") {
		const parsedValue = Number(value);
		return Number.isFinite(parsedValue) ? parsedValue : null;
	}

	return null;
}

export function normalizeStationPrices(
	rawPrices: unknown,
	fallbackFuelType: FuelType,
	fallbackPricePerLiter: number,
) {
	const prices = createEmptyFuelPriceMap();

	if (rawPrices && typeof rawPrices === "object" && !Array.isArray(rawPrices)) {
		for (const fuelType of fuelTypes) {
			prices[fuelType] = safeNumber(
				rawPrices[fuelType as keyof typeof rawPrices],
			);
		}
	}

	if (
		Number.isFinite(fallbackPricePerLiter) &&
		fallbackPricePerLiter > 0 &&
		prices[fallbackFuelType] === null
	) {
		prices[fallbackFuelType] = fallbackPricePerLiter;
	}

	return prices;
}

export function mapGasStationRow(station: Tables<"gas_stations">): GasStation {
	const fallbackPricePerLiter = Number(station.price_per_liter) || 0;
	const fallbackFuelType = fuelTypes.includes(station.fuel_type as FuelType)
		? (station.fuel_type as FuelType)
		: undefined;
	const prices = normalizeStationPrices(
		station.prices,
		fallbackFuelType ?? "Unleaded",
		fallbackPricePerLiter,
	);
	const fallbackStatus = stationStatuses.includes(
		station.status as GasStation["status"],
	)
		? (station.status as GasStation["status"])
		: undefined;
	const fuelAvailability = normalizeFuelAvailability(
		station.fuel_availability,
		fallbackFuelType,
		fallbackStatus,
	);
	const derivedSummary =
		getFuelSummarySelection(prices, fuelAvailability, fallbackFuelType) ??
		null;
	const fallbackSummaryFuelType =
		fuelTypes.find(
			(type) =>
				fuelAvailability[type] !== null || prices[type] !== null,
		) ?? "Unleaded";
	const fuelType = derivedSummary?.fuelType ?? fallbackFuelType ?? fallbackSummaryFuelType;
	const status =
		derivedSummary?.status ??
		fuelAvailability[fuelType] ??
		(fallbackStatus ?? "Out");
	const pricePerLiter =
		derivedSummary?.price ?? prices[fuelType] ?? fallbackPricePerLiter;

	return {
		id: station.id,
		name: station.name,
		address: station.address,
		lat: station.lat,
		lng: station.lng,
		googlePlaceId: station.google_place_id,
		stationBrandLogoId: station.station_brand_logo_id,
		provinceCode: station.province_code,
		cityMunicipalityCode: station.city_municipality_code,
		prices,
		fuelAvailability,
		previousPrices: normalizeFuelPrices(station.previous_prices),
		priceTrends: normalizeFuelPrices(station.price_trends),
		isVerified: station.is_verified,
		isLguVerified: station.is_lgu_verified,
		lguVerifiedAt: station.lgu_verified_at,
		lguVerifiedBy: station.lgu_verified_by,
		lguVerifiedRole:
			station.lgu_verified_role as
				| "province_admin"
				| "city_admin"
				| "lgu_staff"
				| null,
		verifiedAt: station.verified_at,
		managerUserId: station.manager_user_id,
		status,
		fuelType,
		pricePerLiter,
		updatedAt: station.updated_at,
		lastUpdated: formatDistanceToNow(new Date(station.updated_at), {
			addSuffix: true,
		}),
		reportCount: station.report_count,
	};
}

export function mapPublicStationSummaryRow(summaryRow: {
	total_stations: number | null;
	average_unleaded: number | null;
	average_premium: number | null;
	average_diesel: number | null;
	average_premium_diesel: number | null;
	average_kerosene: number | null;
}): PublicStationSummary {
	return {
		totalStations: Number(summaryRow.total_stations ?? 0),
		averagePrices: {
			Unleaded: safeNumber(summaryRow.average_unleaded),
			Premium: safeNumber(summaryRow.average_premium),
			Diesel: safeNumber(summaryRow.average_diesel),
			"Premium Diesel": safeNumber(summaryRow.average_premium_diesel),
			Kerosene: safeNumber(summaryRow.average_kerosene),
		},
	};
}
