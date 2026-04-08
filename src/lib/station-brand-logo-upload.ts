import { supabase } from "@/integrations/supabase/client";

const STATION_BRAND_LOGO_BUCKET = "station-brand-logos";
const MAX_STATION_BRAND_LOGO_BYTES = 2 * 1024 * 1024;

function sanitizeFileSegment(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

export function validateStationBrandLogo(file: File) {
	if (!file.type.startsWith("image/")) {
		return "Please select an image file";
	}

	if (file.size > MAX_STATION_BRAND_LOGO_BYTES) {
		return "Logo image must be under 2MB";
	}

	return null;
}

export async function uploadStationBrandLogo({
	file,
	brandName,
}: {
	file: File;
	brandName: string;
}) {
	const ext = file.name.split(".").pop()?.toLowerCase() || "png";
	const brandSlug = sanitizeFileSegment(brandName) || "brand";
	const filePath = `brands/${brandSlug}-${Date.now()}.${ext}`;

	const { error } = await supabase.storage
		.from(STATION_BRAND_LOGO_BUCKET)
		.upload(filePath, file, { upsert: false });

	if (error) {
		throw new Error(error.message || "Failed to upload station brand logo");
	}

	return {
		path: filePath,
		url: getStationBrandLogoPublicUrl(filePath),
	};
}

export async function removeStationBrandLogo(path: string) {
	const { error } = await supabase.storage
		.from(STATION_BRAND_LOGO_BUCKET)
		.remove([path]);

	if (error) {
		throw new Error(error.message || "Failed to remove station brand logo");
	}
}

export function getStationBrandLogoPublicUrl(path: string) {
	const { data } = supabase.storage
		.from(STATION_BRAND_LOGO_BUCKET)
		.getPublicUrl(path);

	return data.publicUrl;
}
