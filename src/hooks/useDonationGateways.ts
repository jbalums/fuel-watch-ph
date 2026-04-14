import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDonationGatewayQrPublicUrl } from "@/lib/donation-gateway-upload";
import type { DonationGateway } from "@/types/station";

async function fetchDonationGateways(
	onlyActive: boolean,
): Promise<DonationGateway[]> {
	let query = supabase
		.from("donation_gateways")
		.select("*")
		.order("sort_order", { ascending: true })
		.order("gateway_name", { ascending: true });

	if (onlyActive) {
		query = query.eq("is_active", true);
	}

	const { data, error } = await query;

	if (error) {
		throw error;
	}

	return (data ?? []).map((gateway) => ({
		id: gateway.id,
		gatewayName: gateway.gateway_name,
		accountName: gateway.account_name,
		accountNumber: gateway.account_number,
		walletDetails: gateway.wallet_details,
		qrImagePath: gateway.qr_image_path,
		qrImageUrl: gateway.qr_image_path
			? getDonationGatewayQrPublicUrl(gateway.qr_image_path)
			: null,
		isActive: gateway.is_active,
		sortOrder: gateway.sort_order,
		createdAt: gateway.created_at,
		updatedAt: gateway.updated_at,
	}));
}

export function useDonationGateways(options?: { onlyActive?: boolean }) {
	const onlyActive = options?.onlyActive ?? false;

	return useQuery({
		queryKey: ["donation_gateways", onlyActive ? "active" : "all"],
		queryFn: () => fetchDonationGateways(onlyActive),
		staleTime: 5 * 60_000,
	});
}
