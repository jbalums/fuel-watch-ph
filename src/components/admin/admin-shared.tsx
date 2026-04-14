import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
	createEmptyFuelAvailabilityFormMap,
	createEmptyFuelPriceFormMap,
	createEmptyFuelPriceMap,
	fuelTypes,
	getFuelSummarySelection,
	normalizeFuelAvailability,
	normalizeFuelPrices,
	parseFuelAvailabilityForm,
	parseFuelPriceForm,
	type FuelAvailabilityFormMap,
	type FuelAvailabilityFormValue,
	isFuelSellable,
	validateFuelPriceAvailability,
} from "@/lib/fuel-prices";
import type {
	FuelReport,
	FuelReportSubmissionMode,
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
export type StationAvailabilityFormState = FuelAvailabilityFormMap;
export type EasyReportApprovalFormState = {
	stationId: string;
	stationName: string;
	reportedAddress: string;
	provinceCode: string;
	cityMunicipalityCode: string;
	prices: StationPricesFormState;
	fuelAvailability: StationAvailabilityFormState;
};

export type StationFormState = {
	name: string;
	address: string;
	lat: string;
	lng: string;
	googlePlaceId: string;
	stationBrandLogoId: string;
	provinceCode: string;
	cityMunicipalityCode: string;
	prices: StationPricesFormState;
	previousPrices: StationPricesFormState;
	fuelAvailability: StationAvailabilityFormState;
	fuelType: FuelType;
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
	googlePlaceId: "",
	stationBrandLogoId: "",
	provinceCode: "",
	cityMunicipalityCode: "",
	prices: createEmptyFuelPriceFormMap(),
	previousPrices: createEmptyFuelPriceFormMap(),
	fuelAvailability: createEmptyFuelAvailabilityFormMap(),
	fuelType: "Diesel",
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

function isFuelType(value: string | null): value is FuelType {
	return Boolean(value && fuelTypes.includes(value as FuelType));
}

function isStationStatus(
	value: string | null,
): value is StationStatus {
	return value === "Available" || value === "Low" || value === "Out";
}

function mapFuelReport(
	report: FuelReportRow,
	reporterProfiles: Map<string, ProfileRow>,
): FuelReport {
	const fallbackFuelType = isFuelType(report.fuel_type)
		? report.fuel_type
		: undefined;
	const fallbackStatus = isStationStatus(report.status)
		? report.status
		: undefined;
	const prices = normalizeFuelPrices(
		report.prices,
		fallbackFuelType,
		typeof report.price === "number" ? report.price : undefined,
	);
	const fuelAvailability = normalizeFuelAvailability(
		report.fuel_availability,
		fallbackFuelType,
		fallbackStatus,
	);
	const reportedBy = report.user_id;
	const primarySelection = getFuelSummarySelection(
		prices,
		fuelAvailability,
		fallbackFuelType,
	);
	const submissionMode: FuelReportSubmissionMode =
		report.submission_mode === "easy" ? "easy" : "standard";

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
		fuelAvailability,
		price: primarySelection?.price ?? null,
		fuelType: primarySelection?.fuelType ?? fallbackFuelType ?? null,
		status: primarySelection?.status ?? fallbackStatus ?? null,
		reportedAt: report.created_at,
		reportedBy,
		reportedByLabel: formatReportedByLabel(
			reportedBy,
			reporterProfiles.get(reportedBy),
		),
		submissionMode,
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

export function getFuelReportDisplayName(report: Pick<FuelReport, "stationName" | "submissionMode">) {
	const stationName = report.stationName?.trim();
	if (stationName) {
		return stationName;
	}

	return report.submissionMode === "easy"
		? "Easy Report"
		: "Unnamed Report";
}

export function getFuelReportModeLabel(
	submissionMode: FuelReportSubmissionMode,
) {
	return submissionMode === "easy" ? "Easy Report" : "Standard Report";
}

export function createEasyReportApprovalForm(
	report: Pick<
		FuelReport,
		| "stationId"
		| "stationName"
		| "reportedAddress"
		| "provinceCode"
		| "cityMunicipalityCode"
		| "prices"
		| "fuelAvailability"
	>,
) : EasyReportApprovalFormState {
	const prices = createEmptyFuelPriceFormMap();
	const fuelAvailability = createEmptyFuelAvailabilityFormMap();

	for (const fuelType of fuelTypes) {
		const price = report.prices[fuelType];
		prices[fuelType] =
			typeof price === "number" && Number.isFinite(price) && price > 0
				? price.toFixed(2)
				: "";
		fuelAvailability[fuelType] = report.fuelAvailability[fuelType] ?? "";
	}

	return {
		stationId: report.stationId ?? "",
		stationName: report.stationName ?? "",
		reportedAddress: report.reportedAddress ?? "",
		provinceCode: report.provinceCode ?? "",
		cityMunicipalityCode: report.cityMunicipalityCode ?? "",
		prices,
		fuelAvailability,
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
			queryKey: ["admin", "station_experiences"],
		}),
		queryClient.invalidateQueries({
			queryKey: ["lgu", "gas_stations"],
		}),
		queryClient.invalidateQueries({
			queryKey: ["lgu", "fuel_reports"],
		}),
		queryClient.invalidateQueries({
			queryKey: ["lgu", "station_experiences"],
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
		queryClient.invalidateQueries({
			queryKey: ["station_experiences"],
		}),
	]);
}

function formatFuelAvailabilitySummaryValue(
	price: number | null,
	status: StationStatus | null,
) {
	if (status === "Out") {
		return "Out";
	}

	if (typeof price === "number" && Number.isFinite(price) && price > 0) {
		if (status === "Low") {
			return `₱${price.toFixed(2)} (Low)`;
		}

		return `₱${price.toFixed(2)}`;
	}

	return null;
}

export function formatReportedPrices(
	prices: Record<FuelType, number | null>,
	fuelAvailability?: Record<FuelType, StationStatus | null>,
) {
	return fuelTypes
		.map((fuelType) => {
			const value = formatFuelAvailabilitySummaryValue(
				prices[fuelType],
				fuelAvailability?.[fuelType] ?? null,
			);

			return value ? `${fuelType}: ${value}` : null;
		})
		.filter((value): value is string => Boolean(value))
		.join(" • ");
}

export function formatStationPricesSummary(
	rawPrices: unknown,
	fallbackFuelType?: FuelType,
	fallbackPricePerLiter?: number,
	rawFuelAvailability?: unknown,
	fallbackStatus?: StationStatus,
) {
	const prices = normalizeFuelPrices(
		rawPrices,
		fallbackFuelType,
		fallbackPricePerLiter,
	);
	const fuelAvailability = normalizeFuelAvailability(
		rawFuelAvailability,
		fallbackFuelType,
		fallbackStatus,
	);

	return fuelTypes
		.map((fuelType) => {
			const value = formatFuelAvailabilitySummaryValue(
				prices[fuelType],
				fuelAvailability[fuelType],
			);

			return value ? `${fuelType}: ${value}` : null;
		})
		.filter((value): value is string => Boolean(value))
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
	options?: {
		allowEmptyPricing?: boolean;
		allowProvinceOnlyScope?: boolean;
	},
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
	if (
		!options?.allowProvinceOnlyScope &&
		!stationForm.cityMunicipalityCode.trim()
	) {
		throw new Error("City or municipality is required");
	}

	const prices = parseFuelPriceForm(stationForm.prices);
	const submittedPreviousPrices = parseFuelPriceForm(
		stationForm.previousPrices,
	);
	const fuelAvailability = parseFuelAvailabilityForm(
		stationForm.fuelAvailability,
	);
	validateFuelPriceAvailability(prices, fuelAvailability);
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

	const summarySelection = getFuelSummarySelection(
		prices,
		fuelAvailability,
		existingStation?.fuel_type && fuelTypes.includes(existingStation.fuel_type as FuelType)
			? (existingStation.fuel_type as FuelType)
			: stationForm.fuelType,
	);

	if (!summarySelection || !isFuelSellable(summarySelection.status)) {
		if (options?.allowEmptyPricing) {
			return {
				name: stationForm.name.trim(),
				address: stationForm.address.trim(),
				lat,
				lng,
				google_place_id: stationForm.googlePlaceId.trim() || null,
				station_brand_logo_id:
					stationForm.stationBrandLogoId.trim() || null,
				province_code: stationForm.provinceCode.trim(),
				city_municipality_code:
					stationForm.cityMunicipalityCode.trim() || null,
				prices,
				fuel_availability: fuelAvailability,
				previous_prices: nextPreviousPrices,
				price_trends: computeStationPriceTrendMap(
					prices,
					nextPreviousPrices,
				),
				fuel_type: null,
				price_per_liter: 0,
				status: "Out",
			};
		}

		throw new Error(
			"At least one fuel must be marked Available or Low and include a valid price",
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
		google_place_id: stationForm.googlePlaceId.trim() || null,
		station_brand_logo_id: stationForm.stationBrandLogoId.trim() || null,
		province_code: stationForm.provinceCode.trim(),
		city_municipality_code:
			stationForm.cityMunicipalityCode.trim() || null,
		prices,
		fuel_availability: fuelAvailability,
		previous_prices: nextPreviousPrices,
		price_trends: priceTrends,
		fuel_type: summarySelection.fuelType,
		price_per_liter: summarySelection.price,
		status: summarySelection.status,
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

export function normalizeStationAvailabilityForForm(
	rawAvailability: unknown,
	fuelType: FuelType,
	fallbackStatus: StationStatus,
): StationAvailabilityFormState {
	const availability = normalizeFuelAvailability(
		rawAvailability,
		fuelType,
		fallbackStatus,
	);

	return fuelTypes.reduce<StationAvailabilityFormState>((accumulator, key) => {
		accumulator[key] =
			(availability[key] as FuelAvailabilityFormValue | null) ?? "";
		return accumulator;
	}, createEmptyFuelAvailabilityFormMap());
}
