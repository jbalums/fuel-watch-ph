import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/lib/app-toast";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useUserAccess } from "@/hooks/useUserAccess";
import { type ManagedAccessLevel } from "@/lib/access-control";

type ManageableUser = {
	userId: string;
	email: string;
	displayName: string | null;
	avatarUrl: string | null;
	accessLevel: ManagedAccessLevel;
	createdAt: string | null;
	lastLoginAt: string | null;
};

function formatAccessLevelLabel(accessLevel: ManagedAccessLevel) {
	if (accessLevel === "super_admin") {
		return "Super Admin";
	}

	if (accessLevel === "admin") {
		return "Admin";
	}

	return "User";
}

function getAccessLevelStyles(accessLevel: ManagedAccessLevel) {
	if (accessLevel === "super_admin") {
		return "bg-warning/15 text-warning";
	}

	if (accessLevel === "admin") {
		return "bg-accent/15 text-accent";
	}

	return "bg-surface-alt text-muted-foreground";
}

function getAvatarFallback(displayName: string | null, email: string) {
	const baseName = displayName?.trim() || email.trim();
	const parts = baseName.split(/\s+/).filter(Boolean);

	if (parts.length === 0) {
		return "?";
	}

	if (parts.length === 1) {
		return parts[0].slice(0, 2).toUpperCase();
	}

	return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatDateTime(value: string | null) {
	if (!value) {
		return "Never";
	}

	return new Date(value).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

export default function AdminUsersPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const { isSuperAdmin, isLoading: accessLoading } = useUserAccess();
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedAccessByUserId, setSelectedAccessByUserId] = useState<
		Record<string, ManagedAccessLevel>
	>({});

	const {
		data: users = [],
		isLoading: usersLoading,
		error: usersError,
	} = useQuery({
		queryKey: ["admin", "manageable_users"],
		enabled: isSuperAdmin,
		queryFn: async (): Promise<ManageableUser[]> => {
			const { data, error } = await supabase.rpc("list_manageable_users");

			if (error) {
				throw error;
			}

			return (data ?? []).map((userRow) => ({
				userId: userRow.user_id,
				email: userRow.email ?? "",
				displayName: userRow.display_name,
				avatarUrl: userRow.avatar_url,
				accessLevel: userRow.access_level as ManagedAccessLevel,
				createdAt: userRow.created_at,
				lastLoginAt: userRow.last_login_at,
			}));
		},
	});
	const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

	const filteredUsers = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();

		if (!normalizedQuery) {
			return users;
		}

		return users.filter((managedUser) => {
			return (
				managedUser.email.toLowerCase().includes(normalizedQuery) ||
				managedUser.displayName?.toLowerCase().includes(normalizedQuery)
			);
		});
	}, [searchQuery, users]);
	const {
		currentPage,
		totalPages,
		paginatedItems: paginatedUsers,
		setCurrentPage,
	} = usePaginatedList(filteredUsers, searchQuery);

	const updateUserAccess = useMutation({
		mutationFn: async ({
			userId,
			accessLevel,
			email,
		}: {
			userId: string;
			accessLevel: ManagedAccessLevel;
			email: string;
		}) => {
			const { data, error } = await supabase.rpc("set_user_access_level", {
				_target_user_id: userId,
				_access_level: accessLevel,
			});

			if (error) {
				throw error;
			}

			return {
				accessLevel: data as ManagedAccessLevel,
				userId,
				email,
			};
		},
		onSuccess: async (result, variables) => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ["admin", "manageable_users"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["user_access"],
				}),
				queryClient.invalidateQueries({
					queryKey: ["user_role"],
				}),
			]);

			setSelectedAccessByUserId((current) => {
				const next = { ...current };
				delete next[variables.userId];
				return next;
			});

			toast.success(
				`${result.email || "User"} is now ${formatAccessLevelLabel(result.accessLevel)}`,
			);

			if (variables.userId === user?.id && result.accessLevel !== "super_admin") {
				navigate(result.accessLevel === "admin" ? "/admin" : "/");
			}
		},
		onError: (error) => {
			toast.error(error.message);
		},
		onSettled: () => {
			setUpdatingUserId(null);
		},
	});

	if (accessLoading) {
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
							Only super-admin users can manage platform access.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-2xl bg-card p-5 shadow-sovereign">
			<div className="mb-4 flex flex-col gap-3 border-b-2 pb-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h3 className="text-xl font-semibold text-foreground">
						User Access
					</h3>
					<p className="text-sm text-muted-foreground">
						Search users by email or display name and update their platform access.
					</p>
				</div>
				<div className="relative">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search users"
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						className="w-full rounded-xl bg-surface-alt py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 md:w-72"
					/>
				</div>
			</div>

			<div className="flex flex-col gap-3">
				{usersLoading ? (
					<div className="flex items-center justify-center py-10">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : usersError ? (
					<p className="py-8 text-center text-sm text-destructive">
						{usersError instanceof Error
							? usersError.message
							: "Could not load users."}
					</p>
				) : filteredUsers.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">
						No users match the current search.
					</p>
				) : (
					<div className="overflow-hidden rounded-xl border border-border bg-secondary/20">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[84px]">Profile Photo</TableHead>
									<TableHead>User</TableHead>
									<TableHead>Access</TableHead>
									<TableHead>Created At</TableHead>
									<TableHead>Last Login</TableHead>
									<TableHead className="w-[230px]">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{paginatedUsers.map((managedUser) => {
									const selectedAccessLevel =
										selectedAccessByUserId[managedUser.userId] ??
										managedUser.accessLevel;
									const isSaving =
										updatingUserId === managedUser.userId;
									const hasPendingChange =
										selectedAccessLevel !== managedUser.accessLevel;

									return (
										<TableRow key={managedUser.userId}>
											<TableCell>
												<Avatar className="h-11 w-11 ring-1 ring-border">
													<AvatarImage
														src={managedUser.avatarUrl ?? undefined}
													/>
													<AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
														{getAvatarFallback(
															managedUser.displayName,
															managedUser.email,
														)}
													</AvatarFallback>
												</Avatar>
											</TableCell>
											<TableCell>
												<div className="flex min-w-0 items-center gap-3">
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2">
															<p className="truncate font-semibold text-foreground">
																{managedUser.displayName ||
																	managedUser.email}
															</p>
															{managedUser.userId === user?.id && (
																<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
																	You
																</span>
															)}
														</div>
														<p className="mt-1 truncate text-sm text-muted-foreground">
															{managedUser.email}
														</p>
													</div>
												</div>
											</TableCell>
											<TableCell>
												<span
													className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getAccessLevelStyles(
														managedUser.accessLevel,
													)}`}
												>
													{formatAccessLevelLabel(
														managedUser.accessLevel,
													)}
												</span>
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{formatDateTime(managedUser.createdAt)}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{formatDateTime(managedUser.lastLoginAt)}
											</TableCell>
											<TableCell>
												<div className="flex flex-col gap-2">
													<select
														value={selectedAccessLevel}
														onChange={(event) =>
															setSelectedAccessByUserId(
																(current) => ({
																	...current,
																	[managedUser.userId]:
																		event.target
																			.value as ManagedAccessLevel,
																}),
															)
														}
														disabled={isSaving}
														className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
													>
														<option value="user">User</option>
														<option value="admin">Admin</option>
														<option value="super_admin">
															Super Admin
														</option>
													</select>
													<button
														type="button"
														onClick={() => {
															setUpdatingUserId(
																managedUser.userId,
															);
															updateUserAccess.mutate({
																userId: managedUser.userId,
																accessLevel:
																	selectedAccessLevel,
																email: managedUser.email,
															});
														}}
														disabled={
															!hasPendingChange || isSaving
														}
														className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
													>
														{isSaving ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : null}
														{hasPendingChange
															? "Update access"
															: "Current access"}
													</button>
												</div>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
			<AdminListPagination
				currentPage={currentPage}
				totalPages={totalPages}
				onPageChange={setCurrentPage}
			/>
		</div>
	);
}
