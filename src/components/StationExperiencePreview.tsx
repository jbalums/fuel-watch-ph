import { Button } from "@/components/ui/button";
import { useStationExperienceSummary } from "@/hooks/useStationExperiences";
import {
	getStationExperienceSentimentClassName,
	getStationExperienceSentimentLabel,
} from "@/lib/station-experience";
import type { StationExperienceIdentity } from "@/types/station";

interface StationExperiencePreviewProps {
	identity: StationExperienceIdentity | null;
	onOpen?: () => void;
	showAction?: boolean;
}

export function StationExperiencePreview({
	identity,
	onOpen,
	showAction = true,
}: StationExperiencePreviewProps) {
	const { items, count, isLoading } = useStationExperienceSummary(identity);

	if (!identity) {
		return null;
	}

	if (!isLoading && count === 0) {
		return null;
	}

	return (
		<div className="mt-1 rounded-lg border border-border bg-slate-50 px-2 py-2 text-xs text-muted-foreground dark:border-slate-300">
			<div className="flex flex-col items-center justify-between gap-1">
				<div>
					<p className="font-medium text-indigo-700">
						Fuel Station Experience
					</p>
				</div>
				{showAction && onOpen ? (
					<Button
						type="button"
						size="sm"
						variant="outline-primary"
						className="h-6 px-2.5 text-[11px]"
						onClick={onOpen}
					>
						View experiences
					</Button>
				) : null}
			</div>
			{isLoading ? (
				<p className="mt-2 text-[11px]">
					Loading latest experiences...
				</p>
			) : items.length > 0 ? (
				<div className="mt-2 flex flex-col gap-2">
					{items.map((experience) => (
						<div
							key={experience.id}
							className="rounded-md border border-border/70 bg-background/80 px-2.5 py-2"
						>
							<div className="flex items-center gap-2">
								<span
									className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getStationExperienceSentimentClassName(experience.sentiment)}`}
								>
									{getStationExperienceSentimentLabel(
										experience.sentiment,
									)}
								</span>
								<span className="text-[10px] text-muted-foreground">
									{new Date(
										experience.createdAt,
									).toLocaleDateString()}
								</span>
							</div>
							<p className="mt-1 line-clamp-2 text-[11px] text-foreground">
								{experience.experienceText}
							</p>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
