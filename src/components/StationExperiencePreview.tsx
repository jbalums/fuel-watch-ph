import { Button } from "@/components/ui/button";
import { useStationExperienceSummary } from "@/hooks/useStationExperiences";
import {
	getStationExperienceSentimentClassName,
	getStationExperienceSentimentLabel,
} from "@/lib/station-experience";
import type { StationExperienceIdentity } from "@/types/station";

interface StationExperiencePreviewProps {
	identity: StationExperienceIdentity | null;
	onOpen: () => void;
}

export function StationExperiencePreview({
	identity,
	onOpen,
}: StationExperiencePreviewProps) {
	const { items, count, isLoading } = useStationExperienceSummary(identity);

	if (!identity) {
		return null;
	}

	return (
		<div className="mt-3 rounded-lg border border-border bg-slate-100 px-3 py-2 text-xs text-muted-foreground dark:border-slate-300">
			<div className="flex flex-col items-center justify-between gap-2">
				<div>
					<p className="font-medium text-sky-700">
						Fuel Station Experience
					</p>
					<p className="mt-0.5 text-[11px]">
						{count > 0
							? `${count} approved experience${count === 1 ? "" : "s"}`
							: "No approved experiences yet"}
					</p>
				</div>
				<Button
					type="button"
					size="sm"
					variant="outline-primary"
					className="h-7 px-2.5 text-[11px]"
					onClick={onOpen}
				>
					Share your experience!
				</Button>
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
			) : (
				<p className="mt-2 text-[11px]">
					Be the first to share a good or bad station experience.
				</p>
			)}
		</div>
	);
}
