import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { createFuelReportPhotoUrl } from "@/lib/fuel-report-photo-upload";

interface ReportPhotoPreviewDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	photoPath: string | null;
	photoFilename?: string | null;
	title?: string;
	description?: string;
}

export function ReportPhotoPreviewDialog({
	open,
	onOpenChange,
	photoPath,
	photoFilename,
	title = "Reference Photo",
	description = "Review the attached report image at full size.",
}: ReportPhotoPreviewDialogProps) {
	const [photoUrl, setPhotoUrl] = useState<string | null>(null);
	const [photoLoading, setPhotoLoading] = useState(false);
	const [photoError, setPhotoError] = useState<string | null>(null);

	useEffect(() => {
		if (!open || !photoPath) {
			setPhotoUrl(null);
			setPhotoLoading(false);
			setPhotoError(null);
			return;
		}

		let cancelled = false;
		setPhotoLoading(true);
		setPhotoError(null);

		void createFuelReportPhotoUrl(photoPath)
			.then((url) => {
				if (!cancelled) {
					setPhotoUrl(url);
				}
			})
			.catch((error) => {
				if (!cancelled) {
					setPhotoError(
						error instanceof Error
							? error.message
							: "Failed to load report photo",
					);
					setPhotoUrl(null);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setPhotoLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [open, photoPath]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[95vh] max-w-6xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<div className="flex items-center justify-between gap-3">
					<p className="text-xs text-muted-foreground">
						{photoFilename ?? "Attached report image"}
					</p>
					{photoUrl ? (
						<button
							type="button"
							onClick={() =>
								window.open(
									photoUrl,
									"_blank",
									"noopener,noreferrer",
								)
							}
							className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
						>
							<ExternalLink className="h-3.5 w-3.5" />
							Open in New Tab
						</button>
					) : null}
				</div>

				<div className="overflow-hidden rounded-xl border border-border bg-surface-alt">
					{photoLoading ? (
						<div className="flex h-[75vh] items-center justify-center text-sm text-muted-foreground">
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Loading report photo...
						</div>
					) : photoUrl ? (
						<img
							src={photoUrl}
							alt={photoFilename ?? "Report reference photo"}
							className="h-auto max-h-[75vh] w-full object-contain bg-black/5"
						/>
					) : (
						<div className="flex h-[75vh] items-center justify-center px-6 text-center text-sm text-muted-foreground">
							{photoError ?? "No report photo is available."}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
