import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Loader2, ShieldAlert } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/lib/app-toast";
import { GeoScopeFields } from "@/components/GeoScopeFields";
import { useAdminAccessRequest } from "@/hooks/useAdminOnboarding";
import { useGeoReferences } from "@/hooks/useGeoReferences";
import { useUserAccess } from "@/hooks/useUserAccess";
import { formatAccessLevelLabel } from "@/lib/access-control";
import { supabase } from "@/integrations/supabase/client";

export default function AdminAccessRequestDetailPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { requestId } = useParams();
	const { isSuperAdmin, isLoading: accessLoading } = useUserAccess();
	const { data: request, isLoading, error } =
		useAdminAccessRequest(isSuperAdmin ? requestId : undefined);
	const { provinces, citiesByProvince } = useGeoReferences();
	const [approvedRole, setApprovedRole] = useState<
		"province_admin" | "city_admin"
	>("city_admin");
	const [provinceCode, setProvinceCode] = useState("");
	const [cityMunicipalityCode, setCityMunicipalityCode] = useState("");
	const [reviewNotes, setReviewNotes] = useState("");
	const [expiresInDays, setExpiresInDays] = useState("7");
	const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(
		null,
	);

	useEffect(() => {
		if (!request) {
			return;
		}

		setApprovedRole(request.requestedRole);
		setProvinceCode(request.provinceCode);
		setCityMunicipalityCode(request.cityMunicipalityCode ?? "");
		setReviewNotes(request.reviewNotes ?? "");
	}, [request]);

	const availableCities = useMemo(
		() => (provinceCode ? citiesByProvince.get(provinceCode) ?? [] : []),
		[citiesByProvince, provinceCode],
	);
	const isRequestLocked =
		(request?.status ?? "pending") !== "pending" || !!generatedInviteLink;

	const approveRequest = useMutation({
		mutationFn: async () => {
			const { data, error: approveError } = await supabase.rpc(
				"approve_admin_access_request",
				{
					_request_id: requestId!,
					_review_notes: reviewNotes,
					_approved_role: approvedRole,
					_province_code: provinceCode,
					_city_municipality_code:
						approvedRole === "city_admin" ? cityMunicipalityCode : "",
					_expires_in_days: Number(expiresInDays) || 7,
				},
			);

			if (approveError) {
				throw approveError;
			}

			return data?.[0] ?? null;
		},
		onSuccess: async (result) => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["admin", "access_requests"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["admin", "access_requests", requestId],
				}),
				queryClient.invalidateQueries({
					queryKey: ["admin", "invites"],
				}),
			]);

			if (result?.invite_token) {
				setGeneratedInviteLink(
					`${window.location.origin}/admin-invite/${result.invite_token}`,
				);
			}

			toast.success("Access request approved and invite generated");
		},
		onError: (approveError) => toast.error(approveError.message),
	});

	const rejectRequest = useMutation({
		mutationFn: async () => {
			const { error: rejectError } = await supabase.rpc(
				"reject_admin_access_request",
				{
					_request_id: requestId!,
					_review_notes: reviewNotes,
				},
			);

			if (rejectError) {
				throw rejectError;
			}
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["admin", "access_requests"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["admin", "access_requests", requestId],
				}),
			]);

			toast.destructive("Access request rejected");
			navigate("/admin/access-requests");
		},
		onError: (rejectError) => toast.error(rejectError.message),
	});

	const copyInviteLink = async () => {
		if (!generatedInviteLink) {
			return;
		}

		try {
			await navigator.clipboard.writeText(generatedInviteLink);
			toast.info("Invite link copied");
		} catch {
			toast.error("Could not copy the invite link");
		}
	};

	if (accessLoading || isLoading) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!isSuperAdmin) {
		return (
			<div className="rounded-2xl bg-card p-6 shadow-sovereign">
				<div className="flex items-start gap-3">
					<ShieldAlert className="mt-0.5 h-5 w-5 text-warning" />
					<div>
						<h2 className="text-headline text-foreground">
							Super-admin access required
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Only super admins can review official LGU access requests.
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (error || !request) {
		return (
			<div className="rounded-2xl bg-card p-6 shadow-sovereign">
				<p className="text-sm text-destructive">
					{error?.message ?? "Access request not found."}
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-5">
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => navigate("/admin/access-requests")}
					className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-alt text-muted-foreground transition-colors hover:text-foreground"
				>
					<ArrowLeft className="h-5 w-5" />
				</button>
				<div>
					<h3 className="text-xl font-semibold text-foreground">
						Review Official Access Request
					</h3>
					<p className="text-sm text-muted-foreground">
						Approve or reject this request and create a one-time invite.
					</p>
				</div>
			</div>

			<div className="rounded-2xl bg-card p-5 shadow-sovereign">
				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<p className="text-xs text-muted-foreground">Full name</p>
						<p className="font-medium text-foreground">
							{request.fullName}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Email</p>
						<p className="font-medium text-foreground">
							{request.email}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Mobile</p>
						<p className="font-medium text-foreground">
							{request.mobileNumber}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">
							Office / Department
						</p>
						<p className="font-medium text-foreground">
							{request.officeName}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Position</p>
						<p className="font-medium text-foreground">
							{request.positionTitle}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">
							Requested role
						</p>
						<p className="font-medium text-foreground">
							{formatAccessLevelLabel(request.requestedRole)}
						</p>
					</div>
				</div>

				<div className="mt-4">
					<p className="text-xs text-muted-foreground">
						Reason for access
					</p>
					<p className="mt-1 text-sm text-foreground">{request.reason}</p>
				</div>
			</div>

			<div className="rounded-2xl bg-card p-5 shadow-sovereign">
				<div className="grid gap-4">
					<div className="grid gap-4 md:grid-cols-[2fr,1fr]">
						<div className="flex flex-col gap-1.5">
							<label className="text-label text-muted-foreground">
								Approved Role
							</label>
							<select
								value={approvedRole}
								onChange={(event) => {
									const nextRole = event.target
										.value as "province_admin" | "city_admin";
									setApprovedRole(nextRole);
									if (nextRole === "province_admin") {
										setCityMunicipalityCode("");
									}
								}}
								disabled={isRequestLocked}
								className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-70"
							>
								<option value="city_admin">
									City / Municipality Admin
								</option>
								<option value="province_admin">
									Province Admin
								</option>
							</select>
						</div>

						<div className="flex flex-col gap-1.5">
							<label className="text-label text-muted-foreground">
								Invite Expires (days)
							</label>
							<input
								type="number"
								min={1}
								max={30}
								value={expiresInDays}
								onChange={(event) =>
									setExpiresInDays(event.target.value)
								}
								disabled={isRequestLocked}
								className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-70"
							/>
						</div>
					</div>

					<GeoScopeFields
						provinces={provinces}
						cities={availableCities}
						provinceCode={provinceCode}
						cityMunicipalityCode={cityMunicipalityCode}
						requestedRole={approvedRole}
						provinceDisabled={isRequestLocked}
						cityDisabled={isRequestLocked}
						onProvinceChange={(nextProvinceCode) => {
							setProvinceCode(nextProvinceCode);
							setCityMunicipalityCode("");
						}}
						onCityChange={setCityMunicipalityCode}
					/>

					<div className="flex flex-col gap-1.5">
						<label className="text-label text-muted-foreground">
							Review Notes
						</label>
						<textarea
							value={reviewNotes}
							onChange={(event) =>
								setReviewNotes(event.target.value)
							}
							rows={5}
							disabled={isRequestLocked}
							placeholder="Optional notes for the review"
							className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-70"
						/>
					</div>

					{generatedInviteLink ? (
						<div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
							<p className="text-sm font-medium text-foreground">
								Invite link generated
							</p>
							<p className="mt-1 break-all text-xs text-muted-foreground">
								{generatedInviteLink}
							</p>
							<button
								type="button"
								onClick={() => void copyInviteLink()}
								className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
							>
								<Copy className="h-4 w-4" />
								Copy Invite Link
							</button>
						</div>
					) : null}

					{isRequestLocked ? (
						<div className="rounded-xl bg-surface-alt p-4 text-sm text-muted-foreground">
							This request has already been {request.status}. To
							issue another invite, use the Invites page after
							approving a new request.
						</div>
					) : (
						<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
							<button
								type="button"
								onClick={() => rejectRequest.mutate()}
								disabled={
									approveRequest.isPending || rejectRequest.isPending
								}
								className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-60"
							>
								Reject Request
							</button>
							<button
								type="button"
								onClick={() => approveRequest.mutate()}
								disabled={
									approveRequest.isPending || rejectRequest.isPending
								}
								className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
							>
								{approveRequest.isPending ? "Approving..." : "Approve & Generate Invite"}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
