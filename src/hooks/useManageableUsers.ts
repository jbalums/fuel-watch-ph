import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type ManagedAccessLevel } from "@/lib/access-control";

export type ManageableUser = {
	userId: string;
	email: string;
	displayName: string | null;
	avatarUrl: string | null;
	accessLevel: ManagedAccessLevel;
	createdAt: string | null;
	lastLoginAt: string | null;
};

export function useManageableUsers(enabled = true) {
	return useQuery({
		queryKey: ["admin", "manageable_users"],
		enabled,
		queryFn: async (): Promise<ManageableUser[]> => {
			const { data, error } = await supabase.rpc("list_manageable_users");

			if (error) {
				throw error;
			}

			return (data ?? []).map((userRow) => ({
				userId: userRow.user_id,
				email: userRow.email ?? "",
				displayName: userRow.display_name,
				avatarUrl: userRow.avatar_url,
				accessLevel: userRow.access_level as ManagedAccessLevel,
				createdAt: userRow.created_at,
				lastLoginAt: userRow.last_login_at,
			}));
		},
	});
}
