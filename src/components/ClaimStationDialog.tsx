import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import type { GasStation } from "@/types/station";
import { useAuth } from "@/contexts/AuthContext";
import {
	useMyStationClaims,
	useSubmitStationClaim,
} from "@/hooks/useStationClaims";
import {
  STATION_CLAIM_FILE_INPUT_ACCEPT,
  uploadStationClaimProof,
  validateStationClaimProofFile,
} from "@/lib/station-claim-upload";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface ClaimStationDialogProps {
	station: GasStation;
}

export function ClaimStationDialog({ station }: ClaimStationDialogProps) {
	const navigate = useNavigate();
	const { user } = useAuth();
	const { data: myClaims = [] } = useMyStationClaims();
	const submitClaim = useSubmitStationClaim();
	const [open, setOpen] = useState(false);
	const [businessName, setBusinessName] = useState("");
	const [contactName, setContactName] = useState(
		user?.user_metadata?.display_name || user?.user_metadata?.name || "",
	);
	const [contactPhone, setContactPhone] = useState("");
	const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

	const activeClaim = useMemo(
		() =>
			myClaims.find(
				(claim) =>
					claim.stationId === station.id &&
					(claim.reviewStatus === "pending" ||
						claim.reviewStatus === "approved"),
			) ?? null,
		[myClaims, station.id],
	);

	const buttonLabel = activeClaim
		? activeClaim.reviewStatus === "pending"
			? "Claim Pending"
			: "Claim Approved"
		: "Claim Your Station";

  const handleOpen = () => {
		if (!user) {
			navigate("/auth");
			return;
		}

    setOpen(true);
    setUploadError(null);
  };

  const clearSelectedFile = () => {
    setProofFile(null);
    setUploadError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetForm = () => {
    setBusinessName("");
    setContactName(
      user?.user_metadata?.display_name || user?.user_metadata?.name || "",
    );
    setContactPhone("");
    setNotes("");
    setUploadingProof(false);
    clearSelectedFile();
  };

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0] ?? null;
    setUploadError(null);

    if (!file) {
      clearSelectedFile();
      return;
    }

    const validationError = validateStationClaimProofFile(file);
    if (validationError) {
      clearSelectedFile();
      setUploadError(validationError);
      return;
    }

    setProofFile(file);
  };

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		if (!user) {
			navigate("/auth");
			return;
		}

		if (
			!businessName.trim() ||
			!contactName.trim() ||
			!contactPhone.trim()
		) {
			toast.error("Business name, contact name, and phone are required");
			return;
		}

		let uploadedProof:
			| {
					path: string;
					filename: string;
			  }
			| undefined;

		if (proofFile) {
			try {
				setUploadingProof(true);
				setUploadError(null);
				uploadedProof = await uploadStationClaimProof({
					file: proofFile,
					userId: user.id,
				});
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: "Failed to upload proof document";
				setUploadError(message);
				setUploadingProof(false);
				return;
			}
		}

		submitClaim.mutate(
			{
				stationId: station.id,
				userId: user.id,
				businessName: businessName.trim(),
				contactName: contactName.trim(),
				contactPhone: contactPhone.trim(),
				notes,
				proofDocumentPath: uploadedProof?.path ?? null,
				proofDocumentFilename: uploadedProof?.filename ?? null,
			},
			{
				onSuccess: () => {
					toast.success("Station claim request submitted");
					setOpen(false);
					resetForm();
				},
				onError: (error) => {
					toast.error(error.message);
					setUploadError(error.message);
				},
				onSettled: () => {
					setUploadingProof(false);
				},
			},
		);
	};

	if (station.isVerified || station.managerUserId === user?.id) {
		return null;
	}

	return (
		<>
			<button
				type="button"
				onClick={handleOpen}
				disabled={!!activeClaim}
				className="rounded-full bg-background px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{buttonLabel}
			</button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            resetForm();
          }
        }}
      >
        <DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<ShieldCheck className="h-5 w-5 text-accent" />
							Claim {station.name}
						</DialogTitle>
						<DialogDescription>
							Submit your business details for admin review.
							Approved claims receive a verified station badge and
							access to the station manager dashboard.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleSubmit} className="grid gap-3">
						<input
							type="text"
							value={businessName}
							onChange={(event) =>
								setBusinessName(event.target.value)
							}
							placeholder="Business name"
							className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20"
						/>
						<input
							type="text"
							value={contactName}
							onChange={(event) =>
								setContactName(event.target.value)
							}
							placeholder="Contact person"
							className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20"
						/>
						<input
							type="tel"
							value={contactPhone}
							onChange={(event) =>
								setContactPhone(event.target.value)
							}
							placeholder="Contact phone"
							className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20"
						/>
						<textarea
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							placeholder="Optional notes for the admin review team"
							rows={4}
							className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20"
						/>
						<div className="rounded-xl border border-border bg-background p-4">
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="text-sm font-medium text-foreground">
										Proof document
									</p>
									<p className="text-xs text-muted-foreground">
										Upload a PDF or image proof for faster
										admin verification.
									</p>
								</div>
                {proofFile ? (
                  <button
                    type="button"
                    onClick={clearSelectedFile}
                    className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/15"
                  >
										<X className="h-3.5 w-3.5" />
										Remove
									</button>
								) : null}
							</div>
							<label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-alt px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground flex-wrap">
								<FileUp className="h-4 w-4 shrink-0" />
								<span className="min-w-0 flex-1 truncate">
									{proofFile
										? proofFile.name
										: "Choose PDF, JPG, JPEG, or PNG (max 10MB)"}
								</span>
								<span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-foreground">
									{proofFile ? "Replace" : "Browse"}
								</span>
								<input
									ref={fileInputRef}
									type="file"
									accept={STATION_CLAIM_FILE_INPUT_ACCEPT}
									onChange={handleFileChange}
									className="hidden"
								/>
							</label>
							{proofFile && (
								<p className="mt-2 text-xs text-foreground">
									Selected file: {proofFile.name}
								</p>
							)}
							{uploadingProof && (
								<p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
									Uploading proof document...
								</p>
							)}
							{uploadError && (
								<p className="mt-2 text-xs text-destructive">
									{uploadError}
								</p>
							)}
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={
									submitClaim.isPending || uploadingProof
								}
							>
								{(submitClaim.isPending || uploadingProof) && (
									<Loader2 className="h-4 w-4 animate-spin" />
								)}
								{uploadingProof
									? "Uploading Proof..."
									: submitClaim.isPending
										? "Submitting Claim..."
										: "Submit Claim"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
