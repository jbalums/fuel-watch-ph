import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const missionBadgeLabels: Record<string, string> = {
	first_approved_report: "First Approved Report",
	photo_proof_helper: "Photo Proof Helper",
	weekly_scout: "Weekly Scout",
	fuelwatch_hero: "FuelWatch Hero",
};

export function useCurrentUserMissionSummary() {
	const { user } = useAuth();

	return useQuery({
		queryKey: ["missions", "current-user", user?.id],
		enabled: !!user,
		queryFn: async () => {
			const { data, error } = await supabase.rpc(
				"get_current_user_mission_summary",
			);

			if (error) {
				throw error;
			}

			return (
				data?.[0] ?? {
					total_points: 0,
					level: 1,
					approved_report_count: 0,
					current_streak_days: 0,
					longest_streak_days: 0,
					weekly_points: 0,
					weekly_approved_report_count: 0,
					weekly_goal: 3,
					weekly_completed: false,
					badges: [],
				}
			);
		},
	});
}

export function useWeeklyMissionLeaderboard(limit = 5) {
	return useQuery({
		queryKey: ["missions", "weekly-leaderboard", limit],
		queryFn: async () => {
			const { data, error } = await supabase.rpc(
				"get_public_weekly_mission_leaderboard",
				{
					_limit: limit,
				},
			);

			if (error) {
				throw error;
			}

			return data ?? [];
		},
	});
}

export async function getReportMissionRewardSummary(reportId: string) {
	const { data, error } = await supabase.rpc(
		"get_report_mission_reward_summary",
		{
			_report_id: reportId,
		},
	);

	if (error) {
		throw error;
	}

	return data?.[0] ?? { total_points: 0, rewarded_user_label: null };
}
