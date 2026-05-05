import { Award, Flame, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { missionBadgeLabels } from "@/hooks/useMissions";
import { cn } from "@/lib/utils";

type FuelWatchMissionSummary = {
	total_points: number;
	level: number;
	approved_report_count: number;
	current_streak_days: number;
	longest_streak_days: number;
	weekly_points: number;
	weekly_approved_report_count: number;
	weekly_goal: number;
	weekly_completed: boolean;
	badges: string[];
};

export function FuelWatchMissionCard({
	summary,
	compact = false,
	className,
}: {
	summary: FuelWatchMissionSummary;
	compact?: boolean;
	className?: string;
}) {
	const weeklyGoal = Math.max(summary.weekly_goal, 1);
	const weeklyProgress = Math.min(
		100,
		(summary.weekly_approved_report_count / weeklyGoal) * 100,
	);
	const nextLevelPoints = summary.level * 100;
	const currentLevelFloor = (summary.level - 1) * 100;
	const levelProgress = Math.min(
		100,
		((summary.total_points - currentLevelFloor) /
			Math.max(nextLevelPoints - currentLevelFloor, 1)) *
			100,
	);
	const visibleBadges = summary.badges.slice(0, compact ? 2 : 4);

	return (
		<section
			className={cn(
				"gradient-hero relative overflow-hidden rounded-2xl border border-border/70 p-5 shadow-sovereign",
				className,
			)}
		>
			<div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/15 blur-2xl" />
			<div className="pointer-events-none absolute -bottom-12 left-8 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl" />
			<div className="relative flex flex-col gap-4">
				<div className="flex items-start justify-between gap-4">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
							FuelWatch Missions
						</p>
						<h3 className="mt-1 text-xl font-bold text-foreground">
							Fuel Scout Lv. {summary.level}
						</h3>
						<p className="mt-1 text-sm text-muted-foreground">
							Earn points when your fuel price reports are
							approved.
						</p>
					</div>
					<div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-background/70 text-primary shadow-md backdrop-blur">
						<Trophy className="h-6 w-6" />
					</div>
				</div>

				<div className="grid gap-3 sm:grid-cols-3">
					<div className="rounded-xl border border-border/70 bg-background/55 p-3 backdrop-blur">
						<p className="text-xs text-muted-foreground">Points</p>
						<p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
							{summary.total_points}
						</p>
					</div>
					<div className="rounded-xl border border-border/70 bg-background/55 p-3 backdrop-blur">
						<p className="text-xs text-muted-foreground">
							Approved Reports
						</p>
						<p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
							{summary.approved_report_count}
						</p>
					</div>
					<div className="rounded-xl border border-border/70 bg-background/55 p-3 backdrop-blur">
						<p className="text-xs text-muted-foreground">Streak</p>
						<p className="mt-1 flex items-center gap-1 text-2xl font-bold tabular-nums text-foreground">
							<Flame className="h-5 w-5 text-amber-500" />
							{summary.current_streak_days}d
						</p>
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between text-xs">
						<span className="font-medium text-foreground">
							Weekly mission
						</span>
						<span className="text-muted-foreground">
							{summary.weekly_approved_report_count}/
							{weeklyGoal} approved reports
						</span>
					</div>
					<Progress value={weeklyProgress} className="h-2" />
					<p className="text-xs text-muted-foreground">
						{summary.weekly_completed
							? "Weekly Scout complete. Nice work keeping prices fresh."
							: "Complete 3 approved reports this week for a +50 point bonus."}
					</p>
				</div>

				{compact ? null : (
					<div className="space-y-2">
						<div className="flex items-center justify-between text-xs">
							<span className="font-medium text-foreground">
								Next level
							</span>
							<span className="text-muted-foreground">
								{summary.total_points}/{nextLevelPoints} pts
							</span>
						</div>
						<Progress value={levelProgress} className="h-2" />
					</div>
				)}

				{visibleBadges.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{visibleBadges.map((badgeKey) => (
							<span
								key={badgeKey}
								className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
							>
								<Award className="h-3.5 w-3.5" />
								{missionBadgeLabels[badgeKey] ?? badgeKey}
							</span>
						))}
					</div>
				) : null}
			</div>
		</section>
	);
}
