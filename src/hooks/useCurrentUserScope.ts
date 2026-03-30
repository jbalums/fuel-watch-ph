import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CurrentUserScope = {
	scopeType: "province" | "city";
	provinceCode: string;
	provinceName: string;
	cityMunicipalityCode: string | null;
	cityMunicipalityName: string | null;
};

export function useCurrentUserScope(enabled = true) {
	const { user } = useAuth();

	return useQuery({
		queryKey: ["current_user_scope", user?.id],
		enabled: enabled && !!user,
		queryFn: async (): Promise<CurrentUserScope | null> => {
			const { data, error } = await supabase.rpc("get_current_user_scope");

			if (error) {
				throw error;
			}

			const scope = data?.[0];
			if (!scope) {
				return null;
			}

			return {
				scopeType: scope.scope_type as "province" | "city",
				provinceCode: scope.province_code,
				provinceName: scope.province_name,
				cityMunicipalityCode: scope.city_municipality_code,
				cityMunicipalityName: scope.city_municipality_name,
			};
		},
	});
}
