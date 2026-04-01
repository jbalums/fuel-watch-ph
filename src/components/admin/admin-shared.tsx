import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
	createEmptyFuelPriceFormMap,
	createEmptyFuelPriceMap,
	fuelTypes,
	getPrimaryFuelPriceSelection,
	normalizeFuelPrices,
} from "@/lib/fuel-prices";
import type {
	FuelReport,
	FuelReportReviewStatus,
	FuelType,
	StationClaimReviewStatus,
	StationStatus,
} from "@/types/station";
import type { ManagedAccessLevel } from "@/lib/access-control";

export type GasStationRow = Tables<"gas_stations">;
type FuelReportRow = Tables<"fuel_reports">;
type ProfileRow = Pick<
	Tables<"profiles">,
	"user_id" | "display_name" | "username"
>;

export type ReportFilter = FuelReportReviewStatus | "all";
export type ClaimFilter = StationClaimReviewStatus | "all";
export type StationPricesFormState = Record<FuelType, string>;

export type StationFormState = {
	name: string;
	address: string;
	lat: string;
	lng: string;
	provinceCode: string;
	cityMunicipalityCode: string;
	prices: StationPricesFormState;
	previousPrices: StationPricesFormState;
	fuelType: FuelType;
	status: StationStatus;
};

export const reportFilters: { value: ReportFilter; label: string }[] = [
	{ value: "pending", label: "Pending" },
	{ value: "approved", label: "Approved" },
	{ value: "rejected", label: "Rejected" },
	{ value: "all", label: "All" },
];

export const claimFilters: { value: ClaimFilter; label: string }[] = [
	{ value: "pending", label: "Pending" },
	{ value: "approved", label: "Approved" },
	{ value: "rejected", label: "Rejected" },
	{ value: "all", label: "All" },
];

export const initialStationForm: StationFormState = {
	name: "",
	address: "",
	lat: "",
	lng: "",
	provinceCode: "",
	cityMunicipalityCode: "",
	prices: createEmptyFuelPriceFormMap(),
	previousPrices: createEmptyFuelPriceFormMap(),
	fuelType: "Diesel",
	status: "Available",
};

function formatReportedByLabel(
	reportedBy: string,
	profile?: ProfileRow,
) {
	const displayName = profile?.display_name?.trim();
	if (displayName) {
		return displayName;
	}

	const username = profile?.username?.trim();
	if (username) {
		return username;
	}

	return reportedBy.slice(0, 8);
}

function mapFuelReport(
	report: FuelReportRow,
	reporterProfiles: Map<string, ProfileRow>,
): FuelReport {
	const prices = normalizeFuelPrices(
		report.prices,
		report.fuel_type as FuelType,
		Number(report.price) || 0,
	);
	const reportedBy = report.user_id;
	const primarySelection = getPrimaryFuelPriceSelection(prices) ?? {
		fuelType: report.fuel_type as FuelType,
		price: Number(report.price) || 0,
	};

	return {
		id: report.id,
		stationId: report.station_id,
		stationName: report.station_name,
		reportedAddress: report.reported_address,
		lat: report.lat,
		lng: report.lng,
		provinceCode: report.province_code,
		cityMunicipalityCode: report.city_municipality_code,
		photoPath: report.photo_path,
		photoFilename: report.photo_filename,
		photoUrl: null,
		prices,
		price: primarySelection.price,
		fuelType: primarySelection.fuelType,
		status: report.status as StationStatus,
		reportedAt: report.created_at,
		reportedBy,
		reportedByLabel: formatReportedByLabel(
			reportedBy,
			reporterProfiles.get(reportedBy),
		),
		reviewStatus: (report.review_status ??
			"pending") as FuelReportReviewStatus,
		reviewedAt: report.reviewed_at,
		reviewedBy: report.reviewed_by,
		isLguVerified: report.is_lgu_verified,
		lguVerifiedAt: report.lgu_verified_at,
		lguVerifiedBy: report.lgu_verified_by,
		lguVerifiedRole:
			(report.lgu_verified_role as
				| "province_admin"
				| "city_admin"
				| "lgu_staff"
				| null) ?? null,
		appliedStationId: report.applied_station_id,
	};
}

async function fetchReporterProfiles(reports: FuelReportRow[]) {
	const reporterIds = Array.from(
		new Set(reports.map((report) => report.user_id).filter(Boolean)),
	);

	if (reporterIds.length === 0) {
		return new Map<string, ProfileRow>();
	}

	const { data, error } = await supabase
		.from("profiles")
		.select("user_id, display_name, username")
		.in("user_id", reporterIds);

	if (error) {
		throw error;
	}

	return new Map(
		(data ?? []).map((profile) => [profile.user_id, profile]),
	);
}

export function useAdminStations(enabled = true) {
	return useQuery({
		queryKey: ["admin", "gas_stations"],
		enabled,
		queryFn: async () => {
			const { data, error } = await supabase
				.from("gas_stations")
				.select("*")
				.order("updated_at", { ascending: false });

			if (error) {
				throw error;
			}

			return data ?? [];
		},
	});
}

export function useAdminReports(enabled = true) {
	return useQuery({
		queryKey: ["admin", "fuel_reports"],
		enabled,
		queryFn: async () => {
			const { data, error } = await supabase
				.from("fuel_reports")
				.select("*")
				.order("created_at", { ascending: false });

			if (error) {
				throw error;
			}

			const reports = data ?? [];
			const reporterProfiles = await fetchReporterProfiles(reports);

			return reports.map((report) =>
				mapFuelReport(report, reporterProfiles),
			);
		},
	});
}

export function useScopedAdminStations(enabled = true) {
	return useQuery({
		queryKey: ["lgu", "gas_stations"],
		enabled,
		queryFn: async () => {
			const { data, error } = await supabase.rpc(
				"list_scoped_gas_stations",
			);

			if (error) {
				throw error;
			}

			return data ?? [];
		},
	});
}

export function useScopedAdminReports(enabled = true) {
	return useQuery({
		queryKey: ["lgu", "fuel_reports"],
		enabled,
		queryFn: async () => {
			const { data, error } = await supabase.rpc(
				"list_scoped_fuel_reports",
			);

			if (error) {
				throw error;
			}

			const reports = data ?? [];
			const reporterProfiles = await fetchReporterProfiles(reports);

			return reports.map((report) =>
				mapFuelReport(report, reporterProfiles),
			);
		},
	});
}

export function useScopedDashboardStats(enabled = true) {
	return useQuery({
		queryKey: ["lgu", "dashboard_stats"],
		enabled,
		queryFn: async () => {
			const { data, error } = await supabase.rpc(
				"get_scoped_dashboard_stats",
			);

			if (error) {
				throw error;
			}

			return (
				data?.[0] ?? {
					total_stations: 0,
					pending_reports: 0,
					reviewed_reports: 0,
					total_reports: 0,
				}
			);
		},
	});
}

export async function refreshAdminData(queryClient: QueryClient) {
	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: ["admin", "gas_stations"],
		}),
		queryClient.invalidateQueries({
			queryKey: ["admin", "fuel_reports"],
		}),
		queryClient.invalidateQueries({
			queryKey: ["admin", "station_claim_requests"],
		}),
		queryClient.invalidateQueries({
			queryKey: ["lgu", "gas_stations"],
		}),
		queryClient.invalidateQueries({
			queryKey: ["lgu", "fuel_reports"],
		}),
		queryClient.invalidateQueries({
			queryKey: ["lgu", "dashboard_stats"],
		}),
		queryClient.invalidateQueries({ queryKey: ["gas_stations"] }),
		queryClient.invalidateQueries({
			queryKey: ["public_station_browse"],
		}),
		queryClient.invalidateQueries({
			queryKey: ["public_station_summary"],
		}),
	]);
}

export function formatReportedPrices(prices: Record<FuelType, number | null>) {
	return fuelTypes
		.filter((fuelType) => {
			const price = prices[fuelType];
			return (
				typeof price === "number" && Number.isFinite(price) && price > 0
			);
		})
		.map((fuelType) => `${fuelType}: P${prices[fuelType]!.toFixed(2)}`)
		.join(" • ");
}

export function formatStationPricesSummary(
	rawPrices: unknown,
	fallbackFuelType?: FuelType,
	fallbackPricePerLiter?: number,
) {
	const prices = normalizeFuelPrices(
		rawPrices,
		fallbackFuelType,
		fallbackPricePerLiter,
	);

	return fuelTypes
		.filter((fuelType) => {
			const price = prices[fuelType];
			return (
				typeof price === "number" && Number.isFinite(price) && price > 0
			);
		})
		.map((fuelType) => `${fuelType}: ₱${prices[fuelType]!.toFixed(2)}`)
		.join(" • ");
}

export function formatReviewStatusLabel(status: FuelReportReviewStatus) {
	if (status === "pending") return "Pending";
	if (status === "approved") return "Approved";
	return "Rejected";
}

export function ReviewStatusBadge({
	status,
}: {
	status: FuelReportReviewStatus | StationClaimReviewStatus;
}) {
	const styles =
		status === "approved"
			? "bg-success/15 text-success"
			: status === "rejected"
				? "bg-destructive/15 text-destructive"
				: "bg-warning/15 text-warning";

	return (
		<span
			className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles}`}
		>
			{formatReviewStatusLabel(status as FuelReportReviewStatus)}
		</span>
	);
}

function parseStationPriceFormMap(
	priceForm: StationPricesFormState,
) {
	return fuelTypes.reduce<Record<FuelType, number | null>>(
		(accumulator, fuelType) => {
			const rawValue = priceForm[fuelType].trim();
			if (!rawValue) {
				accumulator[fuelType] = null;
				return accumulator;
			}

			const parsedValue = Number.parseFloat(rawValue);
			if (Number.isNaN(parsedValue)) {
				throw new Error(`${fuelType} price must be a valid number`);
			}

			accumulator[fuelType] = parsedValue;
			return accumulator;
		},
		createEmptyFuelPriceMap(),
	);
}

function computeStationPriceTrendMap(
	currentPrices: Record<FuelType, number | null>,
	previousPrices: Record<FuelType, number | null>,
) {
	return fuelTypes.reduce<Record<FuelType, number | null>>(
		(accumulator, fuelType) => {
			const currentPrice = currentPrices[fuelType];
			const previousPrice = previousPrices[fuelType];

			if (
				typeof currentPrice !== "number" ||
				!Number.isFinite(currentPrice) ||
				currentPrice <= 0 ||
				typeof previousPrice !== "number" ||
				!Number.isFinite(previousPrice) ||
				previousPrice <= 0
			) {
				accumulator[fuelType] = null;
				return accumulator;
			}

			accumulator[fuelType] = Number(
				(currentPrice - previousPrice).toFixed(2),
			);
			return accumulator;
		},
		createEmptyFuelPriceMap(),
	);
}

export function buildStationPayload(
	stationForm: StationFormState,
	existingStation?: GasStationRow | null,
) {
	const lat = Number.parseFloat(stationForm.lat);
	const lng = Number.parseFloat(stationForm.lng);

	if (!stationForm.name.trim()) throw new Error("Station name is required");
	if (!stationForm.address.trim())
		throw new Error("Station address is required");
	if (Number.isNaN(lat)) throw new Error("Latitude must be a valid number");
	if (Number.isNaN(lng)) throw new Error("Longitude must be a valid number");
	if (!stationForm.provinceCode.trim()) {
		throw new Error("Province is required");
	}
	if (!stationForm.cityMunicipalityCode.trim()) {
		throw new Error("City or municipality is required");
	}

	const prices = parseStationPriceFormMap(stationForm.prices);
	const submittedPreviousPrices = parseStationPriceFormMap(
		stationForm.previousPrices,
	);
	const previousPrices = existingStation
		? normalizeFuelPrices(existingStation.previous_prices)
		: createEmptyFuelPriceMap();
	const existingCurrentPrices = existingStation
		? normalizeFuelPrices(
				existingStation.prices,
				existingStation.fuel_type as FuelType,
				Number(existingStation.price_per_liter) || 0,
			)
		: createEmptyFuelPriceMap();
	const nextPreviousPrices = { ...previousPrices, ...submittedPreviousPrices };

	const pricePerLiter = prices[stationForm.fuelType];
	if (pricePerLiter === null) {
		throw new Error(
			`Add a ${stationForm.fuelType} price to match the selected fuel type`,
		);
	}

	if (existingStation) {
		for (const fuelType of fuelTypes) {
			const currentPrice = prices[fuelType];
			const existingPrice = existingCurrentPrices[fuelType];

			if (currentPrice === existingPrice) {
				continue;
			}

			if (
				typeof existingPrice === "number" &&
				Number.isFinite(existingPrice) &&
				existingPrice > 0
			) {
				nextPreviousPrices[fuelType] = existingPrice;
			}
		}
	}

	const priceTrends = computeStationPriceTrendMap(
		prices,
		nextPreviousPrices,
	);

	return {
		name: stationForm.name.trim(),
		address: stationForm.address.trim(),
		lat,
		lng,
		province_code: stationForm.provinceCode.trim(),
		city_municipality_code: stationForm.cityMunicipalityCode.trim(),
		prices,
		previous_prices: nextPreviousPrices,
		price_trends: priceTrends,
		fuel_type: stationForm.fuelType,
		price_per_liter: pricePerLiter,
		status: stationForm.status,
	};
}

export function buildStationLguVerificationPayload(
	accessLevel: ManagedAccessLevel,
	userId: string | null | undefined,
) {
	const isLguRole =
		accessLevel === "city_admin" ||
		accessLevel === "province_admin" ||
		accessLevel === "lgu_staff";

	return {
		is_lgu_verified: isLguRole,
		lgu_verified_at:
			isLguRole && userId ? new Date().toISOString() : null,
		lgu_verified_by: isLguRole && userId ? userId : null,
		lgu_verified_role:
			isLguRole && userId ? accessLevel : null,
	};
}

export function normalizeStationPricesForForm(
	rawPrices: unknown,
	fuelType: FuelType,
	fallbackPricePerLiter: number,
): StationPricesFormState {
	const prices = createEmptyFuelPriceFormMap();

	if (
		rawPrices &&
		typeof rawPrices === "object" &&
		!Array.isArray(rawPrices)
	) {
		const pricesRecord = rawPrices as Record<string, unknown>;
		for (const key of fuelTypes) {
			const value = pricesRecord[key];
			if (typeof value === "number" && Number.isFinite(value)) {
				prices[key] = value.toFixed(2);
			} else if (
				typeof value === "string" &&
				value.trim() !== "" &&
				!Number.isNaN(Number(value))
			) {
				prices[key] = Number(value).toFixed(2);
			}
		}
	}

	if (
		!prices[fuelType] &&
		Number.isFinite(fallbackPricePerLiter) &&
		fallbackPricePerLiter > 0
	) {
		prices[fuelType] = fallbackPricePerLiter.toFixed(2);
	}

	return prices;
}
