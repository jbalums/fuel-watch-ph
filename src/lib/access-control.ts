import type { Enums } from "@/integrations/supabase/types";

export type AppRole = Enums<"app_role">;
export type ManagedAccessLevel =
	| "user"
	| "admin"
	| "super_admin"
	| "province_admin"
	| "city_admin";

export function getManagedAccessLevelFromRoles(
	roles: AppRole[],
): ManagedAccessLevel {
	if (roles.includes("super_admin")) {
		return "super_admin";
	}

	if (roles.includes("admin")) {
		return "admin";
	}

	if (roles.includes("province_admin")) {
		return "province_admin";
	}

	if (roles.includes("city_admin")) {
		return "city_admin";
	}

	return "user";
}

export function getDashboardPathForAccessLevel(accessLevel: ManagedAccessLevel) {
	if (
		accessLevel === "super_admin" ||
		accessLevel === "admin"
	) {
		return "/admin";
	}

	if (
		accessLevel === "province_admin" ||
		accessLevel === "city_admin"
	) {
		return "/lgu";
	}

	return "/";
}

export function formatAccessLevelLabel(accessLevel: ManagedAccessLevel) {
	switch (accessLevel) {
		case "super_admin":
			return "Super Admin";
		case "admin":
			return "Admin";
		case "province_admin":
			return "Province Admin";
		case "city_admin":
			return "City Admin";
		default:
			return "User";
	}
}
