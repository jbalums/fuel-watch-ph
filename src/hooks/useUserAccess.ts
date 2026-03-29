import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Enums } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;
export type ManagedAccessLevel = "user" | "admin" | "super_admin";

interface UserAccessResult {
	roles: AppRole[];
	accessLevel: ManagedAccessLevel;
	isAdmin: boolean;
	isSuperAdmin: boolean;
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
			const isAdmin = isSuperAdmin || roles.includes("admin");
			const accessLevel: ManagedAccessLevel = isSuperAdmin
				? "super_admin"
				: isAdmin
					? "admin"
					: "user";

			return {
				roles,
				accessLevel,
				isAdmin,
				isSuperAdmin,
			};
		},
	});

	return {
		roles: data?.roles ?? [],
		accessLevel: data?.accessLevel ?? "user",
		isAdmin: data?.isAdmin ?? false,
		isSuperAdmin: data?.isSuperAdmin ?? false,
		isLoading,
	};
}
