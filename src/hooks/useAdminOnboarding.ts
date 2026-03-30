import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

export type OfficialAdminRole = Extract<
	Enums<"app_role">,
	"province_admin" | "city_admin"
>;

export type AdminAccessRequestRecord = {
	id: string;
	fullName: string;
	email: string;
	mobileNumber: string;
	officeName: string;
	positionTitle: string;
	requestedRole: OfficialAdminRole;
	provinceCode: string;
	provinceName: string;
	cityMunicipalityCode: string | null;
	cityMunicipalityName: string | null;
	reason: string;
	status: "pending" | "approved" | "rejected";
	reviewNotes: string | null;
	reviewedBy: string | null;
	reviewedByName: string | null;
	reviewedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

export type AdminInviteRecord = {
	id: string;
	accessRequestId: string | null;
	email: string;
	fullName: string | null;
	role: OfficialAdminRole;
	provinceCode: string;
	provinceName: string;
	cityMunicipalityCode: string | null;
	cityMunicipalityName: string | null;
	createdBy: string;
	createdByName: string | null;
	expiresAt: string;
	usedAt: string | null;
	usedBy: string | null;
	usedByName: string | null;
	createdAt: string;
};

export type ValidatedAdminInvite = {
	inviteId: string;
	email: string;
	fullName: string | null;
	role: OfficialAdminRole;
	provinceCode: string;
	provinceName: string;
	cityMunicipalityCode: string | null;
	cityMunicipalityName: string | null;
	expiresAt: string;
};

export function useAdminAccessRequests(enabled = true) {
	return useQuery({
		queryKey: ["admin", "access_requests"],
		enabled,
		queryFn: async (): Promise<AdminAccessRequestRecord[]> => {
			const { data, error } = await supabase.rpc(
				"list_admin_access_requests",
			);

			if (error) {
				throw error;
			}

			return (data ?? []).map((row) => ({
				id: row.id,
				fullName: row.full_name,
				email: row.email,
				mobileNumber: row.mobile_number,
				officeName: row.office_name,
				positionTitle: row.position_title,
				requestedRole: row.requested_role as OfficialAdminRole,
				provinceCode: row.province_code,
				provinceName: row.province_name,
				cityMunicipalityCode: row.city_municipality_code,
				cityMunicipalityName: row.city_municipality_name,
				reason: row.reason,
				status: row.status as AdminAccessRequestRecord["status"],
				reviewNotes: row.review_notes,
				reviewedBy: row.reviewed_by,
				reviewedByName: row.reviewed_by_name,
				reviewedAt: row.reviewed_at,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			}));
		},
	});
}

export function useAdminAccessRequest(requestId: string | undefined) {
	return useQuery({
		queryKey: ["admin", "access_requests", requestId],
		enabled: !!requestId,
		queryFn: async (): Promise<AdminAccessRequestRecord | null> => {
			const { data, error } = await supabase.rpc(
				"get_admin_access_request",
				{
					_request_id: requestId!,
				},
			);

			if (error) {
				throw error;
			}

			const row = data?.[0];
			if (!row) {
				return null;
			}

			return {
				id: row.id,
				fullName: row.full_name,
				email: row.email,
				mobileNumber: row.mobile_number,
				officeName: row.office_name,
				positionTitle: row.position_title,
				requestedRole: row.requested_role as OfficialAdminRole,
				provinceCode: row.province_code,
				provinceName: row.province_name,
				cityMunicipalityCode: row.city_municipality_code,
				cityMunicipalityName: row.city_municipality_name,
				reason: row.reason,
				status: row.status as AdminAccessRequestRecord["status"],
				reviewNotes: row.review_notes,
				reviewedBy: row.reviewed_by,
				reviewedByName: row.reviewed_by_name,
				reviewedAt: row.reviewed_at,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			};
		},
	});
}

export function useAdminInvites(enabled = true) {
	return useQuery({
		queryKey: ["admin", "invites"],
		enabled,
		queryFn: async (): Promise<AdminInviteRecord[]> => {
			const { data, error } = await supabase.rpc("list_admin_invites");

			if (error) {
				throw error;
			}

			return (data ?? []).map((row) => ({
				id: row.id,
				accessRequestId: row.access_request_id,
				email: row.email,
				fullName: row.full_name,
				role: row.role as OfficialAdminRole,
				provinceCode: row.province_code,
				provinceName: row.province_name,
				cityMunicipalityCode: row.city_municipality_code,
				cityMunicipalityName: row.city_municipality_name,
				createdBy: row.created_by,
				createdByName: row.created_by_name,
				expiresAt: row.expires_at,
				usedAt: row.used_at,
				usedBy: row.used_by,
				usedByName: row.used_by_name,
				createdAt: row.created_at,
			}));
		},
	});
}

export function useValidatedAdminInvite(token: string | undefined) {
	return useQuery({
		queryKey: ["admin", "invite_validation", token],
		enabled: !!token,
		retry: false,
		queryFn: async (): Promise<ValidatedAdminInvite | null> => {
			const { data, error } = await supabase.rpc("validate_admin_invite", {
				_token: token!,
			});

			if (error) {
				throw error;
			}

			const row = data?.[0];
			if (!row) {
				return null;
			}

			return {
				inviteId: row.invite_id,
				email: row.email,
				fullName: row.full_name,
				role: row.role as OfficialAdminRole,
				provinceCode: row.province_code,
				provinceName: row.province_name,
				cityMunicipalityCode: row.city_municipality_code,
				cityMunicipalityName: row.city_municipality_name,
				expiresAt: row.expires_at,
			};
		},
	});
}
