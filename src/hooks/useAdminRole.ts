import { useUserAccess } from "@/hooks/useUserAccess";

export function useAdminRole() {
	const { isAdmin, isSuperAdmin, isLoading } = useUserAccess();

	return { isAdmin, isSuperAdmin, isLoading };
}
