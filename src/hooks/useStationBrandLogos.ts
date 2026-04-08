import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStationBrandLogoPublicUrl } from "@/lib/station-brand-logo-upload";
import type { StationBrandLogo } from "@/types/station";

async function fetchStationBrandLogos(): Promise<StationBrandLogo[]> {
	const { data, error } = await supabase
		.from("station_brand_logos")
		.select("*")
		.order("brand_name", { ascending: true });

	if (error) {
		throw error;
	}

	return (data ?? []).map((brandLogo) => ({
		id: brandLogo.id,
		brandName: brandLogo.brand_name,
		matchKeywords: brandLogo.match_keywords ?? [],
		logoPath: brandLogo.logo_path,
		logoUrl: getStationBrandLogoPublicUrl(brandLogo.logo_path),
		isActive: brandLogo.is_active,
		createdAt: brandLogo.created_at,
		updatedAt: brandLogo.updated_at,
	}));
}

export function useStationBrandLogos(enabled = true) {
	return useQuery({
		queryKey: ["station_brand_logos"],
		enabled,
		queryFn: fetchStationBrandLogos,
		staleTime: 5 * 60_000,
	});
}
