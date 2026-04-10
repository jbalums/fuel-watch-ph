import { Loader2 } from "lucide-react";
import { StationsSummaryView } from "@/components/stations/StationsSummaryView";
import { useScopedAdminStations } from "@/components/admin/admin-shared";

export default function LguStationsSummaryPage() {
	const { data: stations = [], isLoading } = useScopedAdminStations();

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
			description="Review current station coverage and average fuel prices inside your assigned LGU scope."
			stations={stations}
			searchPlaceholder="Search scoped stations"
		/>
	);
}
