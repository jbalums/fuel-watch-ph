import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	BadgeCheck,
	Loader2,
	Pencil,
	Plus,
	Search,
	Trash2,
} from "lucide-react";
import { toast } from "@/lib/app-toast";
import { supabase } from "@/integrations/supabase/client";
import { AdminStationEditor } from "@/components/admin/AdminStationEditor";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { StatusBadge } from "@/components/StatusBadge";
import { LguVerifiedBadge } from "@/components/LguVerifiedBadge";
import { VerifiedStationBadge } from "@/components/VerifiedStationBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentUserScope } from "@/hooks/useCurrentUserScope";
import { useUserAccess } from "@/hooks/useUserAccess";
import type { FuelType, StationStatus } from "@/types/station";
import {
	buildStationLguVerificationPayload,
	buildStationPayload,
	type GasStationRow,
	initialStationForm,
	type StationFormState,
	normalizeStationPricesForForm,
	refreshAdminData,
	useScopedAdminStations,
} from "@/components/admin/admin-shared";

export default function LguStationsPage() {
	const queryClient = useQueryClient();
	const isMobile = useIsMobile();
	const { user } = useAuth();
	const { accessLevel } = useUserAccess();
	const { data: scope } = useCurrentUserScope();
	const { data: stations = [], isLoading: stationsLoading } =
		useScopedAdminStations();
	const [editorOpen, setEditorOpen] = useState(false);
	const [editingStationId, setEditingStationId] = useState<string | null>(
		null,
	);
	const [stationForm, setStationForm] =
		useState<StationFormState>(initialStationForm);
	const initialEditorFormRef = useRef<StationFormState>(initialStationForm);
	const [stationSearch, setStationSearch] = useState("");
	const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
	const [verificationTarget, setVerificationTarget] =
		useState<GasStationRow | null>(null);
	const [stationToDelete, setStationToDelete] = useState<GasStationRow | null>(
		null,
	);
	const pendingActionRef = useRef<(() => void) | null>(null);

	const filteredStations = useMemo(() => {
		const query = stationSearch.trim().toLowerCase();
		if (!query) return stations;

		return stations.filter((station) => {
			return (
				station.name.toLowerCase().includes(query) ||
				station.address.toLowerCase().includes(query)
			);
		});
	}, [stationSearch, stations]);
	const {
		currentPage,
		totalPages,
		paginatedItems: paginatedStations,
		setCurrentPage,
	} = usePaginatedList(filteredStations, stationSearch);

	const isEditorDirty = useMemo(
		() =>
			editorOpen &&
			JSON.stringify(stationForm) !==
				JSON.stringify(initialEditorFormRef.current),
		[editorOpen, stationForm],
	);

	const saveStation = useMutation({
		mutationFn: async () => {
			const payload = {
				...buildStationPayload(stationForm),
				...buildStationLguVerificationPayload(accessLevel, user?.id),
			};

			if (editingStationId) {
				const { error } = await supabase
					.from("gas_stations")
					.update(payload)
					.eq("id", editingStationId);

				if (error) throw error;
				return "updated" as const;
			}

			const { error } = await supabase.from("gas_stations").insert({
				...payload,
				report_count: 0,
			});

			if (error) throw error;
			return "created" as const;
		},
		onSuccess: async (mode) => {
			await refreshAdminData(queryClient);
			toast.success(
				mode === "created" ? "Station created" : "Station updated",
			);
			initialEditorFormRef.current = initialStationForm;
			setStationForm(initialStationForm);
			setEditingStationId(null);
			setEditorOpen(false);
		},
		onError: (error) => toast.error(error.message),
	});

	const deleteStation = useMutation({
		mutationFn: async (stationId: string) => {
			const { error } = await supabase
				.from("gas_stations")
				.delete()
				.eq("id", stationId);
			if (error) throw error;
		},
		onSuccess: async () => {
			await refreshAdminData(queryClient);
			toast.deleted("Station deleted");
		},
		onError: (error) => toast.error(error.message),
	});

	const verifyStation = useMutation({
		mutationFn: async (stationId: string) => {
			const { error } = await supabase
				.from("gas_stations")
				.update(buildStationLguVerificationPayload(accessLevel, user?.id))
				.eq("id", stationId);

			if (error) throw error;
		},
		onSuccess: async () => {
			await refreshAdminData(queryClient);
			toast.success("Station marked as LGU verified");
			setVerificationTarget(null);
		},
		onError: (error) => toast.error(error.message),
	});

	const runWithUnsavedGuard = (action: () => void) => {
		if (saveStation.isPending) {
			return;
		}

		if (!isEditorDirty) {
			action();
			return;
		}

		pendingActionRef.current = action;
		setDiscardConfirmOpen(true);
	};

	const openCreateStation = () => {
		const nextForm: StationFormState = {
			...initialStationForm,
			provinceCode: scope?.provinceCode ?? "",
			cityMunicipalityCode:
				scope?.scopeType === "city"
					? scope.cityMunicipalityCode ?? ""
					: "",
		};
		initialEditorFormRef.current = nextForm;
		setEditingStationId(null);
		setStationForm(nextForm);
		setEditorOpen(true);
	};

	const openEditStation = (station: GasStationRow) => {
		const nextForm: StationFormState = {
			name: station.name,
			address: station.address,
			lat: String(station.lat),
			lng: String(station.lng),
			provinceCode: station.province_code ?? scope?.provinceCode ?? "",
			cityMunicipalityCode:
				station.city_municipality_code ??
				(scope?.scopeType === "city"
					? scope.cityMunicipalityCode ?? ""
					: ""),
			prices: normalizeStationPricesForForm(
				station.prices,
				station.fuel_type as FuelType,
				Number(station.price_per_liter) || 0,
			),
			fuelType: station.fuel_type as FuelType,
			status: station.status as StationStatus,
		};

		initialEditorFormRef.current = nextForm;
		setEditingStationId(station.id);
		setStationForm(nextForm);
		setEditorOpen(true);
	};

	const requestCloseEditor = () => {
		runWithUnsavedGuard(() => {
			initialEditorFormRef.current = initialStationForm;
			setStationForm(initialStationForm);
			setEditingStationId(null);
			setEditorOpen(false);
		});
	};

	const confirmDiscardChanges = () => {
		setDiscardConfirmOpen(false);
		const pendingAction = pendingActionRef.current;
		pendingActionRef.current = null;
		pendingAction?.();
	};

	const cancelDiscardChanges = () => {
		setDiscardConfirmOpen(false);
		pendingActionRef.current = null;
	};

	const requestVerifyStation = (station: GasStationRow) => {
		setVerificationTarget(station);
	};

	const confirmVerifyStation = () => {
		if (!verificationTarget || verifyStation.isPending) {
			return;
		}

		verifyStation.mutate(verificationTarget.id);
	};

	const cancelVerifyStation = () => {
		if (verifyStation.isPending) {
			return;
		}

		setVerificationTarget(null);
	};

	const confirmDeleteStation = () => {
		if (!stationToDelete || deleteStation.isPending) {
			return;
		}

		deleteStation.mutate(stationToDelete.id, {
			onSuccess: async () => {
				await refreshAdminData(queryClient);
				toast.deleted("Station deleted");
				setStationToDelete(null);
			},
			onError: (error) => toast.error(error.message),
		});
	};

	return (
		<>
			<div className="rounded-2xl bg-card p-5 shadow-sovereign">
				<div className="mb-4 flex flex-col gap-3 border-b-2 pb-4 md:flex-row md:items-center md:justify-between">
					<div>
						<h3 className="text-xl font-semibold text-foreground">
							Scoped Stations
						</h3>
						<p className="text-sm text-muted-foreground">
							Manage stations inside your assigned LGU scope.
						</p>
					</div>
					<div className="flex flex-col gap-2 md:flex-row">
						<div className="relative">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<input
								type="text"
								placeholder="Search stations"
								value={stationSearch}
								onChange={(event) =>
									setStationSearch(event.target.value)
								}
								className="w-full rounded-xl bg-surface-alt py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 md:w-64"
							/>
						</div>
						<button
							onClick={() => runWithUnsavedGuard(openCreateStation)}
							className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
						>
							<Plus className="h-4 w-4" />
							Add Station
						</button>
					</div>
				</div>

				<div className="flex flex-col gap-3">
					{stationsLoading ? (
						<div className="flex items-center justify-center py-10">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : filteredStations.length === 0 ? (
						<p className="py-8 text-center text-sm text-muted-foreground">
							No scoped stations found.
						</p>
					) : (
						paginatedStations.map((station) => (
							<div
								key={station.id}
								className="rounded-xl border border-border bg-secondary/40 p-4"
							>
								<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-semibold text-foreground">
												{station.name}
											</p>
											{station.is_lgu_verified && (
												<LguVerifiedBadge className="py-0.5" />
											)}
											{station.is_verified && (
												<VerifiedStationBadge className="py-0.5" />
											)}
											<StatusBadge
												status={station.status as StationStatus}
											/>
										</div>
										<p className="mt-1 text-sm text-muted-foreground">
											{station.address}
										</p>
										<p className="mt-2 text-sm text-muted-foreground">
											{station.fuel_type} • ₱
											{Number(station.price_per_liter).toFixed(
												2,
											)}{" "}
											• {station.report_count} reports
										</p>
									</div>
									<div className="flex gap-2">
										<button
											onClick={() =>
												requestVerifyStation(station)
											}
											disabled={
												verifyStation.isPending ||
												station.is_lgu_verified
											}
											className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
										>
											<BadgeCheck className="h-4 w-4" />
											{station.is_lgu_verified
												? "LGU verified"
												: "Mark as verified"}
										</button>
										<button
											onClick={() =>
												runWithUnsavedGuard(() =>
													openEditStation(station),
												)
											}
											className="flex items-center gap-1.5 rounded-lg bg-surface-alt px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
										>
											<Pencil className="h-4 w-4" />
											Edit
										</button>
										<button
											onClick={() =>
												setStationToDelete(station)
											}
											disabled={deleteStation.isPending}
											className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-50"
										>
											<Trash2 className="h-4 w-4" />
											Delete
										</button>
									</div>
								</div>
							</div>
						))
					)}
				</div>

				<AdminListPagination
					currentPage={currentPage}
					totalPages={totalPages}
					onPageChange={setCurrentPage}
				/>
			</div>

			<AdminStationEditor
				open={editorOpen}
				mode={editingStationId ? "edit" : "create"}
				form={stationForm}
				stations={stations}
				isMobile={isMobile}
				isSaving={saveStation.isPending}
				lockedProvinceCode={scope?.provinceCode ?? null}
				lockedCityMunicipalityCode={
					scope?.scopeType === "city"
						? scope.cityMunicipalityCode ?? null
						: null
				}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) {
						requestCloseEditor();
						return;
					}

					setEditorOpen(true);
				}}
				onFormChange={(updater) =>
					setStationForm((current) =>
						typeof updater === "function"
							? updater(current)
							: updater,
					)
				}
				onSubmit={() => saveStation.mutate()}
				onCancel={requestCloseEditor}
			/>

			<AlertDialog
				open={discardConfirmOpen}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) {
						cancelDiscardChanges();
						return;
					}

					setDiscardConfirmOpen(true);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
						<AlertDialogDescription>
							Your station edits haven&apos;t been saved yet.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={cancelDiscardChanges}>
							Keep editing
						</AlertDialogCancel>
						<AlertDialogAction onClick={confirmDiscardChanges}>
							Discard changes
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={!!verificationTarget}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) {
						cancelVerifyStation();
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Mark station as LGU verified?</AlertDialogTitle>
						<AlertDialogDescription>
							This confirms that the LGU has reviewed the station
							location and the currently shown prices for{" "}
							<strong>{verificationTarget?.name ?? "this station"}</strong>.
							The public station views will show the LGU verified
							badge after confirmation.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={cancelVerifyStation}
							disabled={verifyStation.isPending}
						>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmVerifyStation}
							disabled={verifyStation.isPending}
						>
							{verifyStation.isPending
								? "Marking..."
								: "Confirm verification"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={!!stationToDelete}
				onOpenChange={(open) => {
					if (!open && !deleteStation.isPending) {
						setStationToDelete(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete station record?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently remove the station record from
							your scoped station list.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{stationToDelete && (
						<div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
							<p className="font-semibold text-foreground">
								{stationToDelete.name}
							</p>
							<p className="mt-1 text-muted-foreground">
								{stationToDelete.address}
							</p>
							<p className="mt-2 text-muted-foreground">
								{stationToDelete.fuel_type} • ₱
								{Number(stationToDelete.price_per_liter).toFixed(2)}
							</p>
							<p className="text-xs text-muted-foreground">
								{stationToDelete.lat.toFixed(5)},{" "}
								{stationToDelete.lng.toFixed(5)}
							</p>
						</div>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteStation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmDeleteStation}
							disabled={deleteStation.isPending}
						>
							{deleteStation.isPending
								? "Deleting..."
								: "Delete station"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
