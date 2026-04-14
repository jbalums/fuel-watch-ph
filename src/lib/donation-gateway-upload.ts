import { supabase } from "@/integrations/supabase/client";

const DONATION_GATEWAY_BUCKET = "donation-gateways";
const MAX_DONATION_QR_BYTES = 4 * 1024 * 1024;

function sanitizeFileSegment(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

export function validateDonationGatewayQr(file: File) {
	if (!file.type.startsWith("image/")) {
		return "Please select an image file";
	}

	if (file.size > MAX_DONATION_QR_BYTES) {
		return "QR image must be under 4MB";
	}

	return null;
}

export async function uploadDonationGatewayQr({
	file,
	gatewayName,
}: {
	file: File;
	gatewayName: string;
}) {
	const ext = file.name.split(".").pop()?.toLowerCase() || "png";
	const gatewaySlug = sanitizeFileSegment(gatewayName) || "gateway";
	const filePath = `qr/${gatewaySlug}-${Date.now()}.${ext}`;

	const { error } = await supabase.storage
		.from(DONATION_GATEWAY_BUCKET)
		.upload(filePath, file, { upsert: false });

	if (error) {
		throw new Error(error.message || "Failed to upload donation QR image");
	}

	return {
		path: filePath,
		url: getDonationGatewayQrPublicUrl(filePath),
	};
}

export async function removeDonationGatewayQr(path: string) {
	const { error } = await supabase.storage
		.from(DONATION_GATEWAY_BUCKET)
		.remove([path]);

	if (error) {
		throw new Error(
			error.message || "Failed to remove donation gateway QR image",
		);
	}
}

export function getDonationGatewayQrPublicUrl(path: string) {
	const { data } = supabase.storage
		.from(DONATION_GATEWAY_BUCKET)
		.getPublicUrl(path);

	return data.publicUrl;
}
