import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { StationsSummaryView } from "@/components/stations/StationsSummaryView";
import {
	useScopedAdminStations,
	useScopedStationSummaryPricesAsOf,
} from "@/components/admin/admin-shared";

function buildManilaEndOfDayIso(dateValue: string) {
	if (!dateValue) {
		return null;
	}

	return new Date(`${dateValue}T23:59:59.999+08:00`).toISOString();
}

function formatAsOfDateLabel(dateValue: string) {
	if (!dateValue) {
		return null;
	}

	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "Asia/Manila",
	}).format(new Date(`${dateValue}T12:00:00+08:00`));
}

export default function LguStationsSummaryPage() {
	const [asOfDate, setAsOfDate] = useState("");
	const asOfTimestamp = useMemo(
		() => buildManilaEndOfDayIso(asOfDate),
		[asOfDate],
	);
	const asOfDateLabel = useMemo(
		() => formatAsOfDateLabel(asOfDate),
		[asOfDate],
	);
	const { data: currentStations = [], isLoading: currentLoading } =
		useScopedAdminStations(!asOfTimestamp);
	const {
		data: historicalStations = [],
		isLoading: historicalLoading,
	} = useScopedStationSummaryPricesAsOf({
		asOf: asOfTimestamp,
	});
	const stations = asOfTimestamp ? historicalStations : currentStations;
	const isLoading = asOfTimestamp ? historicalLoading : currentLoading;

	if (isLoading) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<StationsSummaryView
			title="Stations Summary"
			description={
				asOfDateLabel
					? "Review historical station coverage and fuel prices from approved report history inside your assigned scope."
					: "Review current station coverage and average fuel prices inside your assigned LGU scope."
			}
			stations={stations}
			searchPlaceholder="Search scoped stations"
			asOfDateLabel={asOfDateLabel}
			exportFileName={
				asOfDate
					? `stations-summary-as-of-${asOfDate}.xlsx`
					: "stations-summary-current.xlsx"
			}
			headerFilters={
				<div className="rounded-2xl border border-border bg-secondary/20 p-4">
					<div className="mb-3">
						<p className="text-sm font-medium text-foreground">
							As of date
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Leave blank to show current scoped station prices.
						</p>
					</div>
					<div className="flex gap-2">
						<input
							type="date"
							value={asOfDate}
							onChange={(event) =>
								setAsOfDate(event.target.value)
							}
							className="min-h-10 w-full rounded-xl bg-surface-alt px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
						/>
						{asOfDate ? (
							<button
								type="button"
								onClick={() => setAsOfDate("")}
								className="rounded-xl border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
							>
								Clear
							</button>
						) : null}
					</div>
				</div>
			}
		/>
	);
}
