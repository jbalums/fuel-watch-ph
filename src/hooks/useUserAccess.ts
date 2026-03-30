import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Enums } from "@/integrations/supabase/types";
import {
	getManagedAccessLevelFromRoles,
	type ManagedAccessLevel,
} from "@/lib/access-control";

type AppRole = Enums<"app_role">;

interface UserAccessResult {
	roles: AppRole[];
	accessLevel: ManagedAccessLevel;
	isAdmin: boolean;
	isLegacyAdmin: boolean;
	isSuperAdmin: boolean;
	isProvinceAdmin: boolean;
	isCityAdmin: boolean;
	isLguAdmin: boolean;
}

export function useUserAccess() {
	const { user } = useAuth();

	const { data, isLoading } = useQuery({
		queryKey: ["user_access", user?.id],
		enabled: !!user,
		queryFn: async (): Promise<UserAccessResult> => {
			const { data: roleRows, error } = await supabase
				.from("user_roles")
				.select("role")
				.eq("user_id", user!.id);

			if (error) {
				throw error;
			}

			const roles = (roleRows ?? []).map((roleRow) => roleRow.role);
			const isSuperAdmin = roles.includes("super_admin");
			const isLegacyAdmin = isSuperAdmin || roles.includes("admin");
			const isProvinceAdmin = roles.includes("province_admin");
			const isCityAdmin = roles.includes("city_admin");
			const isLguAdmin = isProvinceAdmin || isCityAdmin;
			const accessLevel = getManagedAccessLevelFromRoles(roles);

			return {
				roles,
				accessLevel,
				isAdmin: isLegacyAdmin,
				isLegacyAdmin,
				isSuperAdmin,
				isProvinceAdmin,
				isCityAdmin,
				isLguAdmin,
			};
		},
	});

	return {
		roles: data?.roles ?? [],
		accessLevel: data?.accessLevel ?? "user",
		isAdmin: data?.isAdmin ?? false,
		isLegacyAdmin: data?.isLegacyAdmin ?? false,
		isSuperAdmin: data?.isSuperAdmin ?? false,
		isProvinceAdmin: data?.isProvinceAdmin ?? false,
		isCityAdmin: data?.isCityAdmin ?? false,
		isLguAdmin: data?.isLguAdmin ?? false,
		isLoading,
	};
}
