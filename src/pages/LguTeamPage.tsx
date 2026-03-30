import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	Copy,
	Loader2,
	Search,
	ShieldAlert,
	UserPlus,
	Users,
	UserX,
} from "lucide-react";
import { toast } from "@/lib/app-toast";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { supabase } from "@/integrations/supabase/client";
import {
	useLguScopeMembers,
	useLguStaffInvites,
	type LguScopeMemberRecord,
} from "@/hooks/useAdminOnboarding";
import { useCurrentUserScope } from "@/hooks/useCurrentUserScope";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useUserAccess } from "@/hooks/useUserAccess";

function formatScopeLabel(
	provinceName: string,
	cityMunicipalityName: string | null,
	scopeType: "province" | "city",
) {
	if (scopeType === "city" && cityMunicipalityName) {
		return `${cityMunicipalityName}, ${provinceName}`;
	}

	return provinceName;
}

export default function LguTeamPage() {
	const queryClient = useQueryClient();
	const {
		isProvinceAdmin,
		isCityAdmin,
		isLoading: accessLoading,
	} = useUserAccess();
	const isTeamManager = isProvinceAdmin || isCityAdmin;
	const { data: scope, isLoading: scopeLoading } =
		useCurrentUserScope(isTeamManager);
	const {
		data: members = [],
		isLoading: membersLoading,
		error: membersError,
	} = useLguScopeMembers(isTeamManager);
	const {
		data: invites = [],
		isLoading: invitesLoading,
		error: invitesError,
	} = useLguStaffInvites(isTeamManager);
	const [searchQuery, setSearchQuery] = useState("");
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteFullName, setInviteFullName] = useState("");
	const [expiresInDays, setExpiresInDays] = useState("7");
	const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(
		null,
	);
	const [memberToRevoke, setMemberToRevoke] =
		useState<LguScopeMemberRecord | null>(null);

	const filteredMembers = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();

		if (!normalizedQuery) {
			return members;
		}

		return members.filter((member) => {
			return (
				member.email.toLowerCase().includes(normalizedQuery) ||
				member.displayName?.toLowerCase().includes(normalizedQuery) ||
				member.username?.toLowerCase().includes(normalizedQuery)
			);
		});
	}, [members, searchQuery]);

	const filteredInvites = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();

		if (!normalizedQuery) {
			return invites;
		}

		return invites.filter((invite) => {
			return (
				invite.email.toLowerCase().includes(normalizedQuery) ||
				invite.fullName?.toLowerCase().includes(normalizedQuery)
			);
		});
	}, [invites, searchQuery]);

	const {
		currentPage: membersPage,
		totalPages: memberPages,
		paginatedItems: paginatedMembers,
		setCurrentPage: setMembersPage,
	} = usePaginatedList(filteredMembers, searchQuery);
	const {
		currentPage: invitesPage,
		totalPages: invitePages,
		paginatedItems: paginatedInvites,
		setCurrentPage: setInvitesPage,
	} = usePaginatedList(filteredInvites, searchQuery);

	const issueInvite = useMutation({
		mutationFn: async () => {
			const { data, error } = await supabase.rpc("issue_lgu_staff_invite", {
				_email: inviteEmail,
				_full_name: inviteFullName || null,
				_expires_in_days: Number(expiresInDays) || 7,
			});

			if (error) {
				throw error;
			}

			return data?.[0] ?? null;
		},
		onSuccess: async (result) => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["lgu", "staff_invites"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["admin", "invites"],
				}),
			]);

			setGeneratedInviteLink(
				result?.invite_token
					? `${window.location.origin}/admin-invite/${result.invite_token}`
					: null,
			);
			setInviteEmail("");
			setInviteFullName("");
			setExpiresInDays("7");
			toast.success("LGU staff invite generated");
		},
		onError: (error) => toast.error(error.message),
	});

	const revokeMember = useMutation({
		mutationFn: async (userId: string) => {
			const { error } = await supabase.rpc("revoke_lgu_staff_access", {
				_target_user_id: userId,
			});

			if (error) {
				throw error;
			}
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["lgu", "scope_members"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["user_access"],
				}),
			]);
			setMemberToRevoke(null);
			toast.destructive("LGU staff access removed");
		},
		onError: (error) => toast.error(error.message),
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

	const confirmRevoke = () => {
		if (!memberToRevoke || revokeMember.isPending) {
			return;
		}

		revokeMember.mutate(memberToRevoke.userId);
	};

	if (accessLoading || (isTeamManager && scopeLoading)) {
		return (
			<div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sovereign">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!isTeamManager || !scope) {
		return (
			<div className="rounded-2xl bg-card p-6 shadow-sovereign">
				<div className="flex items-start gap-3">
					<ShieldAlert className="mt-0.5 h-5 w-5 text-warning" />
					<div>
						<h2 className="text-headline text-foreground">
							LGU manager access required
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Only province and city admins can invite or manage
							LGU staff members.
						</p>
					</div>
				</div>
			</div>
		);
	}

	const scopeLabel = formatScopeLabel(
		scope.provinceName,
		scope.cityMunicipalityName,
		scope.scopeType,
	);

	return (
		<>
			<div className="flex flex-col gap-5">
				<div className="rounded-2xl bg-card p-5 shadow-sovereign">
					<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
						<div>
							<div className="flex items-center gap-2">
								<Users className="h-5 w-5 text-accent" />
								<h3 className="text-xl font-semibold text-foreground">
									LGU Team
								</h3>
							</div>
							<p className="mt-1 text-sm text-muted-foreground">
								Invite scoped staff members who can help review
								and update fuel data inside {scopeLabel}.
							</p>
							<p className="mt-2 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
								Scoped to {scopeLabel}
							</p>
						</div>
						<div className="relative">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<input
								type="text"
								placeholder="Search team or invites"
								value={searchQuery}
								onChange={(event) =>
									setSearchQuery(event.target.value)
								}
								className="w-full rounded-xl bg-surface-alt py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 md:w-72"
							/>
						</div>
					</div>
				</div>

				<div className="rounded-2xl bg-card p-5 shadow-sovereign">
					<div className="mb-4">
						<h4 className="text-lg font-semibold text-foreground">
							Invite LGU Staff
						</h4>
						<p className="text-sm text-muted-foreground">
							New staff members inherit your current LGU scope and
							can help manage stations and reports, but they
							cannot manage users.
						</p>
					</div>

					<form
						onSubmit={(event) => {
							event.preventDefault();
							issueInvite.mutate();
						}}
						className="grid gap-3 md:grid-cols-[2fr,2fr,140px,auto]"
					>
						<div className="flex flex-col gap-1.5">
							<label className="text-label text-muted-foreground">
								Email Address
							</label>
							<input
								type="email"
								placeholder="Email address"
								value={inviteEmail}
								onChange={(event) =>
									setInviteEmail(event.target.value)
								}
								className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<label className="text-label text-muted-foreground">
								Full Name
							</label>
							<input
								type="text"
								placeholder="Full name (optional)"
								value={inviteFullName}
								onChange={(event) =>
									setInviteFullName(event.target.value)
								}
								className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<label className="text-label text-muted-foreground">
								Expires In Days
							</label>
							<input
								type="number"
								min="1"
								max="30"
								placeholder="7"
								value={expiresInDays}
								onChange={(event) =>
									setExpiresInDays(event.target.value)
								}
								className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
							/>
						</div>
						<button
							type="submit"
							disabled={issueInvite.isPending}
							className="mt-[22px] flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
						>
							{issueInvite.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<UserPlus className="h-4 w-4" />
							)}
							Generate invite
						</button>
					</form>

					{generatedInviteLink ? (
						<div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-4">
							<p className="text-sm font-medium text-foreground">
								Invite link ready
							</p>
							<p className="mt-1 break-all text-xs text-muted-foreground">
								{generatedInviteLink}
							</p>
							<button
								type="button"
								onClick={() => void copyInviteLink()}
								className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
							>
								<Copy className="h-4 w-4" />
								Copy invite link
							</button>
						</div>
					) : null}
				</div>

				<div className="rounded-2xl bg-card p-5 shadow-sovereign">
					<div className="mb-4">
						<h4 className="text-lg font-semibold text-foreground">
							Current Staff
						</h4>
						<p className="text-sm text-muted-foreground">
							Active LGU staff members assigned inside your scope.
						</p>
					</div>

					<div className="flex flex-col gap-3">
						{membersLoading ? (
							<div className="flex items-center justify-center py-10">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : membersError ? (
							<p className="py-8 text-center text-sm text-destructive">
								{membersError.message}
							</p>
						) : filteredMembers.length === 0 ? (
							<p className="py-8 text-center text-sm text-muted-foreground">
								No LGU staff members found.
							</p>
						) : (
							paginatedMembers.map((member) => (
								<div
									key={member.userId}
									className="rounded-xl border border-border bg-secondary/40 p-4"
								>
									<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
										<div className="min-w-0 flex-1">
											<p className="font-semibold text-foreground">
												{member.displayName ??
													member.email}
											</p>
											<p className="mt-1 text-sm text-muted-foreground">
												{member.email}
												{member.username
													? ` • @${member.username}`
													: ""}
											</p>
											<p className="mt-2 text-xs text-muted-foreground">
												Scope:{" "}
												{formatScopeLabel(
													member.provinceName,
													member.cityMunicipalityName,
													member.scopeType,
												)}
											</p>
											<p className="mt-1 text-xs text-muted-foreground">
												Invited by{" "}
												{member.invitedByName ??
													"FuelWatch PH"}{" "}
												• Joined{" "}
												{new Date(
													member.createdAt,
												).toLocaleString()}
											</p>
										</div>
										<button
											type="button"
											onClick={() =>
												setMemberToRevoke(member)
											}
											disabled={revokeMember.isPending}
											className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-50"
										>
											<UserX className="h-4 w-4" />
											Revoke access
										</button>
									</div>
								</div>
							))
						)}
					</div>

					<AdminListPagination
						currentPage={membersPage}
						totalPages={memberPages}
						onPageChange={setMembersPage}
					/>
				</div>

				<div className="rounded-2xl bg-card p-5 shadow-sovereign">
					<div className="mb-4">
						<h4 className="text-lg font-semibold text-foreground">
							Staff Invites
						</h4>
						<p className="text-sm text-muted-foreground">
							Recent invite activity for your LGU scope.
						</p>
					</div>

					<div className="flex flex-col gap-3">
						{invitesLoading ? (
							<div className="flex items-center justify-center py-10">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : invitesError ? (
							<p className="py-8 text-center text-sm text-destructive">
								{invitesError.message}
							</p>
						) : filteredInvites.length === 0 ? (
							<p className="py-8 text-center text-sm text-muted-foreground">
								No staff invites found.
							</p>
						) : (
							paginatedInvites.map((invite) => {
								const statusLabel = invite.usedAt
									? "Used"
									: new Date(invite.expiresAt).getTime() <=
										  Date.now()
										? "Expired"
										: "Active";
								const statusClass =
									statusLabel === "Used"
										? "bg-success/15 text-success"
										: statusLabel === "Expired"
											? "bg-destructive/15 text-destructive"
											: "bg-warning/15 text-warning";

								return (
									<div
										key={invite.id}
										className="rounded-xl border border-border bg-secondary/40 p-4"
									>
										<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<p className="font-semibold text-foreground">
														{invite.fullName ??
															invite.email}
													</p>
													<span
														className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}
													>
														{statusLabel}
													</span>
												</div>
												<p className="mt-1 text-sm text-muted-foreground">
													{invite.email}
												</p>
												<p className="mt-2 text-xs text-muted-foreground">
													{invite.cityMunicipalityName
														? `${invite.cityMunicipalityName}, ${invite.provinceName}`
														: invite.provinceName}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													Issued by{" "}
													{invite.createdByName ??
														"FuelWatch PH"}{" "}
													•{" "}
													{new Date(
														invite.createdAt,
													).toLocaleString()}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													Expires{" "}
													{new Date(
														invite.expiresAt,
													).toLocaleString()}
													{invite.usedAt
														? ` • Used ${new Date(invite.usedAt).toLocaleString()}`
														: ""}
												</p>
											</div>
										</div>
									</div>
								);
							})
						)}
					</div>

					<AdminListPagination
						currentPage={invitesPage}
						totalPages={invitePages}
						onPageChange={setInvitesPage}
					/>
				</div>
			</div>

			<AlertDialog
				open={!!memberToRevoke}
				onOpenChange={(open) => {
					if (!open && !revokeMember.isPending) {
						setMemberToRevoke(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Revoke LGU staff access?</AlertDialogTitle>
						<AlertDialogDescription>
							This will remove the selected staff member&apos;s
							scoped LGU access immediately.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{memberToRevoke ? (
						<div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
							<p className="font-semibold text-foreground">
								{memberToRevoke.displayName ??
									memberToRevoke.email}
							</p>
							<p className="mt-1 text-muted-foreground">
								{memberToRevoke.email}
								{memberToRevoke.username
									? ` • @${memberToRevoke.username}`
									: ""}
							</p>
							<p className="mt-1 text-muted-foreground">
								Scope:{" "}
								{formatScopeLabel(
									memberToRevoke.provinceName,
									memberToRevoke.cityMunicipalityName,
									memberToRevoke.scopeType,
								)}
							</p>
						</div>
					) : null}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={revokeMember.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmRevoke}
							disabled={revokeMember.isPending}
						>
							{revokeMember.isPending
								? "Revoking..."
								: "Revoke access"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
