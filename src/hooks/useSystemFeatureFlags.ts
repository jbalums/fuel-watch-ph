import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const MAP_GET_DIRECTIONS_FEATURE_KEY = "map_get_directions_enabled";
export const MAP_GET_DIRECTIONS_FEATURE_DESCRIPTION =
	"Controls the inline Get Directions route renderer on /map. Open in Maps stays available.";
export const MAP_AUTO_DISCOVER_FEATURE_KEY = "map_auto_discover_enabled";
export const MAP_AUTO_DISCOVER_FEATURE_DESCRIPTION =
	"Controls automatic Google-based fuel station discovery on /map when the map view moves.";
export const MAINTENANCE_MODE_FEATURE_KEY = "maintenance_mode_enabled";
export const MAINTENANCE_MODE_FEATURE_DESCRIPTION =
	"Shows the maintenance page on public routes while keeping admin and auth routes accessible.";

export type SystemFeatureFlag = {
	featureKey: string;
	isEnabled: boolean;
	description: string;
	updatedAt: string | null;
};

export function useSystemFeatureFlag(
	featureKey: string,
	defaultValue = false,
	defaultDescription = "",
) {
	return useQuery({
		queryKey: ["system_feature_flag", featureKey],
		queryFn: async (): Promise<SystemFeatureFlag> => {
			const { data, error } = await supabase
				.from("system_feature_flags")
				.select("feature_key, is_enabled, description, updated_at")
				.eq("feature_key", featureKey)
				.maybeSingle();

			if (error) {
				throw error;
			}

			return {
				featureKey,
				isEnabled: data?.is_enabled ?? defaultValue,
				description: data?.description ?? defaultDescription,
				updatedAt: data?.updated_at ?? null,
			};
		},
		staleTime: 60_000,
	});
}

export function useMapDirectionsFeature() {
	return useSystemFeatureFlag(
		MAP_GET_DIRECTIONS_FEATURE_KEY,
		false,
		MAP_GET_DIRECTIONS_FEATURE_DESCRIPTION,
	);
}

export function useMapAutoDiscoverFeature() {
	return useSystemFeatureFlag(
		MAP_AUTO_DISCOVER_FEATURE_KEY,
		true,
		MAP_AUTO_DISCOVER_FEATURE_DESCRIPTION,
	);
}

export function useMaintenanceModeFeature() {
	return useSystemFeatureFlag(
		MAINTENANCE_MODE_FEATURE_KEY,
		false,
		MAINTENANCE_MODE_FEATURE_DESCRIPTION,
	);
}
