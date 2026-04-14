import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
	createStationExperiencePhotoUrl,
} from "@/lib/station-experience-photo-upload";
import {
	STATION_EXPERIENCE_PUBLIC_AUTHOR_LABEL,
	hasStationExperienceIdentity,
} from "@/lib/station-experience";
import type {
	StationExperience,
	StationExperienceIdentity,
	StationExperienceReviewStatus,
} from "@/types/station";

type StationExperienceRow = Tables<"station_experiences">;
type ProfileRow = Pick<
	Tables<"profiles">,
	"user_id" | "display_name" | "username"
>;

function formatReporterLabel(
	userId: string,
	profile: ProfileRow | undefined,
	hideIdentity: boolean,
) {
	if (hideIdentity) {
		return STATION_EXPERIENCE_PUBLIC_AUTHOR_LABEL;
	}

	const displayName = profile?.display_name?.trim();
	if (displayName) {
		return displayName;
	}

	const username = profile?.username?.trim();
	if (username) {
		return username;
	}

	return userId.slice(0, 8);
}

async function fetchReporterProfiles(experiences: StationExperienceRow[]) {
	const reporterIds = Array.from(
		new Set(experiences.map((experience) => experience.user_id).filter(Boolean)),
	);

	if (reporterIds.length === 0) {
		return new Map<string, ProfileRow>();
	}

	const { data, error } = await supabase
		.from("profiles")
		.select("user_id, display_name, username")
		.in("user_id", reporterIds);

	if (error) {
		throw error;
	}

	return new Map((data ?? []).map((profile) => [profile.user_id, profile]));
}

async function createPhotoUrls(paths: string[]) {
	const urls = await Promise.all(
		paths.map(async (path) => {
			try {
				return await createStationExperiencePhotoUrl(path);
			} catch {
				return null;
			}
		}),
	);

	return urls.filter((url): url is string => Boolean(url));
}

async function mapStationExperience(
	row: StationExperienceRow,
	options: {
		reporterProfiles: Map<string, ProfileRow>;
		hideIdentity: boolean;
	},
): Promise<StationExperience> {
	return {
		id: row.id,
		userId: row.user_id,
		stationId: row.station_id,
		source: row.source,
		externalId: row.external_id,
		stationName: row.station_name,
		stationAddress: row.station_address,
		lat: row.lat,
		lng: row.lng,
		provinceCode: row.province_code,
		cityMunicipalityCode: row.city_municipality_code,
		sentiment: row.sentiment === "bad" ? "bad" : "good",
		experienceText: row.experience_text,
		photoPaths: row.photo_paths ?? [],
		photoFilenames: row.photo_filenames ?? [],
		photoUrls: await createPhotoUrls(row.photo_paths ?? []),
		reviewStatus:
			(row.review_status as StationExperienceReviewStatus) ?? "pending",
		reviewNotes: row.review_notes,
		reviewedAt: row.reviewed_at,
		reviewedBy: row.reviewed_by,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		reporterLabel: formatReporterLabel(
			row.user_id,
			options.reporterProfiles.get(row.user_id),
			options.hideIdentity,
		),
	};
}

function applyStationExperienceIdentityQuery(
	query: any,
	identity: StationExperienceIdentity,
) {
	if (identity.stationId) {
		return query.eq("station_id", identity.stationId);
	}

	return query
		.eq("source", identity.source ?? "")
		.eq("external_id", identity.externalId ?? "");
}

async function fetchExperiencesByIdentity(options: {
	identity: StationExperienceIdentity;
	reviewStatus?: StationExperienceReviewStatus;
	limit?: number;
	hideIdentity?: boolean;
}) {
	if (!hasStationExperienceIdentity(options.identity)) {
		return {
			items: [] as StationExperience[],
			count: 0,
		};
	}

	let query = applyStationExperienceIdentityQuery(
		supabase
			.from("station_experiences")
			.select("*", { count: "exact" })
			.order("created_at", { ascending: false }),
		options.identity,
	);

	if (options.reviewStatus) {
		query = query.eq("review_status", options.reviewStatus);
	}

	if (typeof options.limit === "number") {
		query = query.limit(options.limit);
	}

	const { data, count, error } = await query;
	if (error) {
		throw error;
	}

	const experiences = data ?? [];
	const reporterProfiles = options.hideIdentity
		? new Map<string, ProfileRow>()
		: await fetchReporterProfiles(experiences);
	const items = await Promise.all(
		experiences.map((experience) =>
			mapStationExperience(experience, {
				reporterProfiles,
				hideIdentity: options.hideIdentity ?? false,
			}),
		),
	);

	return {
		items,
		count: count ?? items.length,
	};
}

async function fetchModeratedExperiences(options: {
	reviewStatus?: StationExperienceReviewStatus | "all";
}) {
	let query = supabase
		.from("station_experiences")
		.select("*")
		.order("created_at", { ascending: false });

	if (options.reviewStatus && options.reviewStatus !== "all") {
		query = query.eq("review_status", options.reviewStatus);
	}

	const { data, error } = await query;
	if (error) {
		throw error;
	}

	const experiences = data ?? [];
	const reporterProfiles = await fetchReporterProfiles(experiences);

	return Promise.all(
		experiences.map((experience) =>
			mapStationExperience(experience, {
				reporterProfiles,
				hideIdentity: false,
			}),
		),
	);
}

export function useApprovedStationExperiences(
	identity: StationExperienceIdentity | null,
) {
	return useQuery({
		queryKey: [
			"station_experiences",
			"approved",
			identity?.stationId ?? null,
			identity?.source ?? null,
			identity?.externalId ?? null,
		],
		queryFn: async () => {
			if (!identity) {
				return [] as StationExperience[];
			}

			const result = await fetchExperiencesByIdentity({
				identity,
				reviewStatus: "approved",
				hideIdentity: true,
			});
			return result.items;
		},
		enabled: hasStationExperienceIdentity(identity),
		staleTime: 30_000,
	});
}

export function useStationExperiencePreview(
	identity: StationExperienceIdentity | null,
) {
	return useQuery({
		queryKey: [
			"station_experiences",
			"preview",
			identity?.stationId ?? null,
			identity?.source ?? null,
			identity?.externalId ?? null,
		],
		queryFn: async () => {
			if (!identity) {
				return { items: [] as StationExperience[], count: 0 };
			}

			return fetchExperiencesByIdentity({
				identity,
				reviewStatus: "approved",
				limit: 2,
				hideIdentity: true,
			});
		},
		enabled: hasStationExperienceIdentity(identity),
		staleTime: 30_000,
	});
}

export function useAdminStationExperiences(
	reviewStatus: StationExperienceReviewStatus | "all" = "all",
) {
	return useQuery({
		queryKey: ["admin", "station_experiences", reviewStatus],
		queryFn: () => fetchModeratedExperiences({ reviewStatus }),
		staleTime: 30_000,
	});
}

export function useScopedStationExperiences(
	reviewStatus: StationExperienceReviewStatus | "all" = "all",
) {
	return useQuery({
		queryKey: ["lgu", "station_experiences", reviewStatus],
		queryFn: () => fetchModeratedExperiences({ reviewStatus }),
		staleTime: 30_000,
	});
}

export function useStationExperienceSummary(
	identity: StationExperienceIdentity | null,
) {
	const previewQuery = useStationExperiencePreview(identity);

	return useMemo(
		() => ({
			items: previewQuery.data?.items ?? [],
			count: previewQuery.data?.count ?? 0,
			isLoading: previewQuery.isLoading,
		}),
		[previewQuery.data, previewQuery.isLoading],
	);
}
