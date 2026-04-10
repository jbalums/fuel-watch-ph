import { useState, type Dispatch, type SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "@/lib/app-toast";
import { GeoScopeFields } from "@/components/GeoScopeFields";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useUserAccess } from "@/hooks/useUserAccess";
import { supabase } from "@/integrations/supabase/client";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { detectGeoScopeFromAddress } from "@/lib/geo-detection";

type BackfillSelection = {
	provinceCode: string;
	cityMunicipalityCode: string;
};

type UnscopedStation = {
	id: string;
	name: string;
	address: string;
};

type UnscopedReport = {
	id: string;
	stationName: string;
	reportedAddress: string | null;
};

export default function AdminGeoBackfillPage() {
	const queryClient = useQueryClient();
	const { isSuperAdmin, isLoading: accessLoading } = useUserAccess();
	const {
		provinces,
		citiesByProvince,
		isLoading: geoLoading,
	} = useGeoReferences({ includeAllCities: true });
	const [stationSelections, setStationSelections] = useState<
		Record<string, BackfillSelection>
	>({});
	const [reportSelections, setReportSelections] = useState<
		Record<string, BackfillSelection>
	>({});

	const {
		data: unscopedStations = [],
		isLoading: stationsLoading,
		error: stationsError,
	} = useQuery({
		queryKey: ["admin", "geo_backfill", "stations"],
		enabled: isSuperAdmin,
		queryFn: async (): Promise<UnscopedStation[]> => {
			const { data, error } = await supabase
				.from("gas_stations")
				.select("id, name, address")
				.is("province_code", null)
				.order("updated_at", { ascending: false });

			if (error) {
				throw error;
			}

			return data ?? [];
		},
	});

	const {
		data: unscopedReports = [],
		isLoading: reportsLoading,
		error: reportsError,
	} = useQuery({
		queryKey: ["admin", "geo_backfill", "reports"],
		enabled: isSuperAdmin,
		queryFn: async (): Promise<UnscopedReport[]> => {
			const { data, error } = await supabase
				.from("fuel_reports")
				.select("id, station_name, reported_address")
				.is("province_code", null)
				.order("created_at", { ascending: false });

			if (error) {
				throw error;
			}

			return (data ?? []).map((report) => ({
				id: report.id,
				stationName: report.station_name,
				reportedAddress: report.reported_address,
			}));
		},
	});

	const {
		currentPage: stationPage,
		totalPages: stationPages,
		paginatedItems: paginatedStations,
		setCurrentPage: setStationPage,
	} = usePaginatedList(unscopedStations, String(unscopedStations.length));
	const {
		currentPage: reportPage,
		totalPages: reportPages,
		paginatedItems: paginatedReports,
		setCurrentPage: setReportPage,
	} = usePaginatedList(unscopedReports, String(unscopedReports.length));

	const updateStationScope = useMutation({
		mutationFn: async ({
			stationId,
			selection,
		}: {
			stationId: string;
			selection: BackfillSelection;
		}) => {
			const { error } = await supabase
				.from("gas_stations")
				.update({
					province_code: selection.provinceCode,
					city_municipality_code: selection.cityMunicipalityCode,
				})
				.eq("id", stationId);

			if (error) {
				throw error;
			}
		},
		onSuccess: async (_, variables) => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["admin", "geo_backfill", "stations"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["admin", "gas_stations"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["lgu", "gas_stations"],
				}),
			]);

			setStationSelections((current) => {
				const next = { ...current };
				delete next[variables.stationId];
				return next;
			});

			toast.success("Station scope updated");
		},
		onError: (error) => toast.error(error.message),
	});

	const updateReportScope = useMutation({
		mutationFn: async ({
			reportId,
			selection,
		}: {
			reportId: string;
			selection: BackfillSelection;
		}) => {
			const { error } = await supabase
				.from("fuel_reports")
				.update({
					province_code: selection.provinceCode,
					city_municipality_code: selection.cityMunicipalityCode,
				})
				.eq("id", reportId);

			if (error) {
				throw error;
			}
		},
		onSuccess: async (_, variables) => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["admin", "geo_backfill", "reports"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["admin", "fuel_reports"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["lgu", "fuel_reports"],
				}),
			]);

			setReportSelections((current) => {
				const next = { ...current };
				delete next[variables.reportId];
				return next;
			});

			toast.success("Report scope updated");
		},
		onError: (error) => toast.error(error.message),
	});

	if (accessLoading) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!isSuperAdmin) {
		return (
			<div className="rounded-2xl bg-card p-6 shadow-sovereign">
				<div className="flex items-start gap-3">
					<ShieldAlert className="mt-0.5 h-5 w-5 text-warning" />
					<div>
						<h2 className="text-headline text-foreground">
							Super-admin access required
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Only super admins can backfill geographic scope
							data.
						</p>
					</div>
				</div>
			</div>
		);
	}

	const renderGeoEditor = (
		id: string,
		address: string,
		selectionMap: Record<string, BackfillSelection>,
		setSelectionMap: Dispatch<
			SetStateAction<Record<string, BackfillSelection>>
		>,
		onSave: (selection: BackfillSelection) => void,
		isSaving: boolean,
	) => {
		const selection = selectionMap[id] ?? {
			provinceCode: "",
			cityMunicipalityCode: "",
		};
		const cities = selection.provinceCode
			? (citiesByProvince.get(selection.provinceCode) ?? [])
			: [];

		return (
			<div className="mt-4 rounded-xl border border-border bg-background p-4">
				<GeoScopeFields
					provinces={provinces}
					cities={cities}
					provinceCode={selection.provinceCode}
					cityMunicipalityCode={selection.cityMunicipalityCode}
					requestedRole="city_admin"
					onProvinceChange={(provinceCode) =>
						setSelectionMap((current) => ({
							...current,
							[id]: {
								provinceCode,
								cityMunicipalityCode: "",
							},
						}))
					}
					onCityChange={(cityMunicipalityCode) =>
						setSelectionMap((current) => ({
							...current,
							[id]: {
								...selection,
								cityMunicipalityCode,
							},
						}))
					}
				/>
				<div className="mt-3 flex flex-col gap-2 sm:flex-row">
					<button
						type="button"
						onClick={() => {
							const detectedScope = detectGeoScopeFromAddress({
								address,
								provinces,
								cities,
							});

							if (!detectedScope) {
								toast.error(
									"Could not detect province or city from this station address",
								);
								return;
							}

							setSelectionMap((current) => ({
								...current,
								[id]: detectedScope,
							}));

							if (
								detectedScope.provinceCode &&
								detectedScope.cityMunicipalityCode
							) {
								toast.success(
									"Province and city were auto-detected from the address",
								);
								return;
							}

							toast.message(
								"Province was detected. Please confirm the city or municipality.",
							);
						}}
						disabled={isSaving || geoLoading}
						className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
					>
						Auto detect
					</button>
					<button
						type="button"
						onClick={() => {
							if (
								!selection.provinceCode ||
								!selection.cityMunicipalityCode
							) {
								toast.error("Select both province and city");
								return;
							}

							onSave(selection);
						}}
						disabled={isSaving || geoLoading}
						className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
					>
						Save scope
					</button>
				</div>
			</div>
		);
	};

	return (
		<div className="flex flex-col gap-6">
			<div className="rounded-2xl bg-card p-5 shadow-sovereign">
				<h3 className="text-xl font-semibold text-foreground">
					Legacy Scope Backfill
				</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					Assign normalized province and city scope to older stations
					and reports before LGU admins start managing live data.
				</p>
			</div>

			<div className="rounded-2xl bg-card p-5 shadow-sovereign">
				<h4 className="text-lg font-semibold text-foreground">
					Unscoped Stations ({unscopedStations.length} stations)
				</h4>
				{stationsLoading ? (
					<div className="flex items-center justify-center py-10">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : stationsError ? (
					<p className="py-8 text-sm text-destructive">
						{stationsError.message}
					</p>
				) : paginatedStations.length === 0 ? (
					<p className="py-8 text-sm text-muted-foreground">
						All stations already have scope data.
					</p>
				) : (
					<div className="mt-4 flex flex-col gap-4">
						{paginatedStations.map((station) => (
							<div
								key={station.id}
								className="rounded-xl border border-border bg-secondary/40 p-4"
							>
								<p className="font-semibold text-foreground">
									{station.name}
								</p>
								<p className="mt-1 text-sm text-muted-foreground">
									{station.address}
								</p>
								{renderGeoEditor(
									station.id,
									station.address,
									stationSelections,
									setStationSelections,
									(selection) =>
										updateStationScope.mutate({
											stationId: station.id,
											selection,
										}),
									updateStationScope.isPending,
								)}
							</div>
						))}
					</div>
				)}
				<AdminListPagination
					currentPage={stationPage}
					totalPages={stationPages}
					onPageChange={setStationPage}
				/>
			</div>

			<div className="rounded-2xl bg-card p-5 shadow-sovereign">
				<h4 className="text-lg font-semibold text-foreground">
					Unscoped Reports
				</h4>
				{reportsLoading ? (
					<div className="flex items-center justify-center py-10">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : reportsError ? (
					<p className="py-8 text-sm text-destructive">
						{reportsError.message}
					</p>
				) : paginatedReports.length === 0 ? (
					<p className="py-8 text-sm text-muted-foreground">
						All reports already have scope data.
					</p>
				) : (
					<div className="mt-4 flex flex-col gap-4">
						{paginatedReports.map((report) => (
							<div
								key={report.id}
								className="rounded-xl border border-border bg-secondary/40 p-4"
							>
								<p className="font-semibold text-foreground">
									{report.stationName}
								</p>
								<p className="mt-1 text-sm text-muted-foreground">
									{report.reportedAddress ??
										"No reported address provided"}
								</p>
								{renderGeoEditor(
									report.id,
									report.reportedAddress ?? "",
									reportSelections,
									setReportSelections,
									(selection) =>
										updateReportScope.mutate({
											reportId: report.id,
											selection,
										}),
									updateReportScope.isPending,
								)}
							</div>
						))}
					</div>
				)}
				<AdminListPagination
					currentPage={reportPage}
					totalPages={reportPages}
					onPageChange={setReportPage}
				/>
			</div>
		</div>
	);
}
