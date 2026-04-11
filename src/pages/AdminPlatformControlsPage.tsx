import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Route, ShieldAlert } from "lucide-react";
import { toast } from "@/lib/app-toast";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import {
	MAP_GET_DIRECTIONS_FEATURE_DESCRIPTION,
	MAP_GET_DIRECTIONS_FEATURE_KEY,
	useMapDirectionsFeature,
} from "@/hooks/useSystemFeatureFlags";

function formatUpdatedAt(value: string | null) {
	if (!value) {
		return "Never updated";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "Never updated";
	}

	return new Intl.DateTimeFormat("en-PH", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(date);
}

export default function AdminPlatformControlsPage() {
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const { isSuperAdmin, isLoading: accessLoading } = useUserAccess();
	const {
		data: mapDirectionsFeature,
		isLoading: featureLoading,
	} = useMapDirectionsFeature();

	const isEnabled = mapDirectionsFeature?.isEnabled ?? false;
	const updatedAtText = useMemo(
		() => formatUpdatedAt(mapDirectionsFeature?.updatedAt ?? null),
		[mapDirectionsFeature?.updatedAt],
	);

	const toggleMapDirections = useMutation({
		mutationFn: async (nextEnabled: boolean) => {
			const { error } = await supabase
				.from("system_feature_flags")
				.upsert(
					{
						feature_key: MAP_GET_DIRECTIONS_FEATURE_KEY,
						is_enabled: nextEnabled,
						description: MAP_GET_DIRECTIONS_FEATURE_DESCRIPTION,
					},
					{ onConflict: "feature_key" },
				);

			if (error) {
				throw error;
			}

			return nextEnabled;
		},
		onSuccess: (nextEnabled) => {
			queryClient.setQueryData(
				["system_feature_flag", MAP_GET_DIRECTIONS_FEATURE_KEY],
				(current: {
					featureKey?: string;
					description?: string;
					updatedAt?: string | null;
				} | null) => ({
					featureKey: MAP_GET_DIRECTIONS_FEATURE_KEY,
					isEnabled: nextEnabled,
					description:
						current?.description ??
						MAP_GET_DIRECTIONS_FEATURE_DESCRIPTION,
					updatedAt: new Date().toISOString(),
				}),
			);
			void queryClient.invalidateQueries({
				queryKey: ["system_feature_flag", MAP_GET_DIRECTIONS_FEATURE_KEY],
			});
			toast.success(
				nextEnabled
					? "Inline map directions are now enabled."
					: "Inline map directions are now disabled.",
			);
		},
		onError: (error) => {
			console.error("Failed to update map directions feature", error);
			toast.error("Could not update the map directions setting.");
		},
	});

	if (accessLoading || featureLoading) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!user || !isSuperAdmin) {
		return (
			<div className="rounded-2xl bg-card p-6 shadow-sovereign">
				<div className="flex items-start gap-3">
					<ShieldAlert className="mt-0.5 h-5 w-5 text-warning" />
					<div>
						<h2 className="text-headline text-foreground">
							Super admin access required
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Only super admins can control platform-wide map
							features.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="rounded-2xl bg-card p-6 shadow-sovereign">
				<div className="flex items-start gap-3">
					<Route className="mt-0.5 h-5 w-5 text-accent" />
					<div>
						<h2 className="text-headline text-foreground">
							Platform Controls
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Manage high-impact map features that can affect
							Google Maps API usage.
						</p>
					</div>
				</div>
			</div>

			<section className="rounded-2xl bg-card p-6 shadow-sovereign">
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div className="max-w-2xl">
						<p className="text-base font-semibold text-foreground">
							Inline Get Directions on `/map`
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							{MAP_GET_DIRECTIONS_FEATURE_DESCRIPTION}
						</p>
						<p className="mt-3 text-xs text-muted-foreground">
							Last updated: {updatedAtText}
						</p>
					</div>
					<div className="flex items-center gap-3 rounded-full border border-border bg-secondary/40 px-4 py-3">
						<span className="text-sm font-medium text-foreground">
							{isEnabled ? "Enabled" : "Disabled"}
						</span>
						<Switch
							checked={isEnabled}
							disabled={toggleMapDirections.isPending}
							onCheckedChange={(checked) => {
								toggleMapDirections.mutate(checked);
							}}
							aria-label="Toggle inline map directions"
						/>
					</div>
				</div>
				<div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
					<p>
						When disabled, the `Get Directions` button is removed on
						`/map`, and only `Open in Maps` remains available.
					</p>
				</div>
			</section>
		</div>
	);
}
