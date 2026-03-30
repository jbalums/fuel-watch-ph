import { useUserAccess } from "@/hooks/useUserAccess";

export function useAdminRole() {
	const { isAdmin, isLegacyAdmin, isSuperAdmin, isLoading } =
		useUserAccess();

	return { isAdmin, isLegacyAdmin, isSuperAdmin, isLoading };
}
