import { useMemo, useState } from "react";
import {
	ArrowUpDown,
	ChevronDown,
	ChevronUp,
	Loader2,
	Search,
	ShieldAlert,
	Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AdminListPagination } from "@/components/admin/AdminListPagination";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	useAdminLguUsers,
	type AdminLguUserRecord,
} from "@/hooks/useAdminOnboarding";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useUserAccess } from "@/hooks/useUserAccess";

type RoleFilter = "all" | AdminLguUserRecord["role"];
type SortKey = "user" | "role" | "scope" | "createdAt" | "lastLoginAt";
type SortDirection = "asc" | "desc";

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

function formatScopeLabel(user: AdminLguUserRecord) {
	if (user.scopeType === "city" && user.cityMunicipalityName) {
		return `${user.cityMunicipalityName}, ${user.provinceName}`;
	}

	return user.provinceName;
}

function formatRoleLabel(role: AdminLguUserRecord["role"]) {
	switch (role) {
		case "province_admin":
			return "Province Admin";
		case "city_admin":
			return "City Admin";
		default:
			return "LGU Staff";
	}
}

function getRoleStyles(role: AdminLguUserRecord["role"]) {
	switch (role) {
		case "province_admin":
			return "bg-warning/15 text-warning";
		case "city_admin":
			return "bg-accent/15 text-accent";
		default:
			return "bg-surface-alt text-muted-foreground";
	}
}

function compareTextValues(a: string, b: string, direction: SortDirection) {
	const result = a.localeCompare(b, undefined, { sensitivity: "base" });
	return direction === "asc" ? result : -result;
}

function compareNumberValues(
	a: number,
	b: number,
	direction: SortDirection,
) {
	const result = a - b;
	return direction === "asc" ? result : -result;
}

function getRoleRank(role: AdminLguUserRecord["role"]) {
	switch (role) {
		case "province_admin":
			return 3;
		case "city_admin":
			return 2;
		default:
			return 1;
	}
}

export default function AdminLguUsersPage() {
	const { isSuperAdmin, isLoading: accessLoading } = useUserAccess();
	const {
		data: users = [],
		isLoading: usersLoading,
		error: usersError,
	} = useAdminLguUsers(isSuperAdmin);
	const [searchQuery, setSearchQuery] = useState("");
	const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
	const [provinceFilter, setProvinceFilter] = useState("all");
	const [sortKey, setSortKey] = useState<SortKey>("createdAt");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

	const provinceOptions = useMemo(() => {
		const provinceMap = new Map<string, string>();

		for (const user of users) {
			provinceMap.set(user.provinceCode, user.provinceName);
		}

		return Array.from(provinceMap.entries())
			.map(([code, name]) => ({ code, name }))
			.sort((left, right) =>
				left.name.localeCompare(right.name, undefined, {
					sensitivity: "base",
				}),
			);
	}, [users]);

	const filteredUsers = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();

		return users.filter((user) => {
			if (roleFilter !== "all" && user.role !== roleFilter) {
				return false;
			}

			if (provinceFilter !== "all" && user.provinceCode !== provinceFilter) {
				return false;
			}

			if (!normalizedQuery) {
				return true;
			}

			return (
				user.email.toLowerCase().includes(normalizedQuery) ||
				user.displayName?.toLowerCase().includes(normalizedQuery) ||
				user.username?.toLowerCase().includes(normalizedQuery) ||
				user.provinceName.toLowerCase().includes(normalizedQuery) ||
				user.cityMunicipalityName
					?.toLowerCase()
					.includes(normalizedQuery) ||
				formatRoleLabel(user.role).toLowerCase().includes(normalizedQuery)
			);
		});
	}, [provinceFilter, roleFilter, searchQuery, users]);

	const sortedUsers = useMemo(() => {
		const nextUsers = [...filteredUsers];

		nextUsers.sort((leftUser, rightUser) => {
			if (sortKey === "user") {
				const leftLabel =
					leftUser.displayName?.trim() || leftUser.email;
				const rightLabel =
					rightUser.displayName?.trim() || rightUser.email;

				return compareTextValues(leftLabel, rightLabel, sortDirection);
			}

			if (sortKey === "role") {
				const roleComparison = compareNumberValues(
					getRoleRank(leftUser.role),
					getRoleRank(rightUser.role),
					sortDirection,
				);

				if (roleComparison !== 0) {
					return roleComparison;
				}

				return compareTextValues(leftUser.email, rightUser.email, "asc");
			}

			if (sortKey === "scope") {
				return compareTextValues(
					formatScopeLabel(leftUser),
					formatScopeLabel(rightUser),
					sortDirection,
				);
			}

			const leftTimestamp = leftUser[sortKey]
				? new Date(leftUser[sortKey] as string).getTime()
				: Number.NEGATIVE_INFINITY;
			const rightTimestamp = rightUser[sortKey]
				? new Date(rightUser[sortKey] as string).getTime()
				: Number.NEGATIVE_INFINITY;

			return compareNumberValues(
				leftTimestamp,
				rightTimestamp,
				sortDirection,
			);
		});

		return nextUsers;
	}, [filteredUsers, sortDirection, sortKey]);

	const {
		currentPage,
		totalPages,
		paginatedItems: paginatedUsers,
		setCurrentPage,
	} = usePaginatedList(
		sortedUsers,
		`${searchQuery}|${roleFilter}|${provinceFilter}|${sortKey}|${sortDirection}`,
	);

	const toggleSort = (nextSortKey: SortKey) => {
		if (sortKey === nextSortKey) {
			setSortDirection((currentDirection) =>
				currentDirection === "asc" ? "desc" : "asc",
			);
			return;
		}

		setSortKey(nextSortKey);
		setSortDirection(nextSortKey === "createdAt" ? "desc" : "asc");
	};

	const renderSortIcon = (columnKey: SortKey) => {
		if (sortKey !== columnKey) {
			return <ArrowUpDown className="h-3.5 w-3.5" />;
		}

		return sortDirection === "asc" ? (
			<ChevronUp className="h-3.5 w-3.5" />
		) : (
			<ChevronDown className="h-3.5 w-3.5" />
		);
	};

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
							Only super-admin users can view LGU user accounts.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-2xl bg-card p-5 shadow-sovereign">
			<div className="mb-4 flex flex-col gap-3 border-b-2 pb-4">
				<div className="flex items-center gap-2">
					<Users className="h-5 w-5 text-accent" />
					<h3 className="text-xl font-semibold text-foreground">
						LGU Users
					</h3>
				</div>
				<p className="text-sm text-muted-foreground">
					View province admins, city admins, and LGU staff accounts
					across all scopes.
				</p>
				<div className="flex flex-col gap-3 md:flex-row md:items-center">
					<div className="relative flex-1">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search LGU users"
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							className="w-full rounded-xl bg-surface-alt py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
						/>
					</div>
					<select
						value={roleFilter}
						onChange={(event) =>
							setRoleFilter(event.target.value as RoleFilter)
						}
						className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
					>
						<option value="all">All Roles</option>
						<option value="province_admin">Province Admin</option>
						<option value="city_admin">City Admin</option>
						<option value="lgu_staff">LGU Staff</option>
					</select>
					<select
						value={provinceFilter}
						onChange={(event) => setProvinceFilter(event.target.value)}
						className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
					>
						<option value="all">All Provinces</option>
						{provinceOptions.map((province) => (
							<option key={province.code} value={province.code}>
								{province.name}
							</option>
						))}
					</select>
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
							: "Could not load LGU users."}
					</p>
				) : filteredUsers.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">
						No LGU users match the current filters.
					</p>
				) : (
					<div className="overflow-hidden rounded-xl border border-border bg-secondary/20">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[84px]">
										Profile Photo
									</TableHead>
									<TableHead>
										<button
											type="button"
											onClick={() => toggleSort("user")}
											className="inline-flex items-center gap-2 text-left font-medium text-muted-foreground transition-colors hover:text-foreground"
										>
											User
											{renderSortIcon("user")}
										</button>
									</TableHead>
									<TableHead>
										<button
											type="button"
											onClick={() => toggleSort("role")}
											className="inline-flex items-center gap-2 text-left font-medium text-muted-foreground transition-colors hover:text-foreground"
										>
											Role
											{renderSortIcon("role")}
										</button>
									</TableHead>
									<TableHead>
										<button
											type="button"
											onClick={() => toggleSort("scope")}
											className="inline-flex items-center gap-2 text-left font-medium text-muted-foreground transition-colors hover:text-foreground"
										>
											Scope
											{renderSortIcon("scope")}
										</button>
									</TableHead>
									<TableHead>
										<button
											type="button"
											onClick={() => toggleSort("createdAt")}
											className="inline-flex items-center gap-2 text-left font-medium text-muted-foreground transition-colors hover:text-foreground"
										>
											Created At
											{renderSortIcon("createdAt")}
										</button>
									</TableHead>
									<TableHead>
										<button
											type="button"
											onClick={() => toggleSort("lastLoginAt")}
											className="inline-flex items-center gap-2 text-left font-medium text-muted-foreground transition-colors hover:text-foreground"
										>
											Last Login
											{renderSortIcon("lastLoginAt")}
										</button>
									</TableHead>
									<TableHead>Invited By</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{paginatedUsers.map((user) => (
									<TableRow key={`${user.role}-${user.userId}`}>
										<TableCell>
											<Avatar className="h-11 w-11 ring-1 ring-border">
												<AvatarImage
													src={user.avatarUrl ?? undefined}
												/>
												<AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
													{getAvatarFallback(
														user.displayName,
														user.email,
													)}
												</AvatarFallback>
											</Avatar>
										</TableCell>
										<TableCell>
											<div className="min-w-0">
												<p className="truncate font-semibold text-foreground">
													{user.displayName || user.email}
												</p>
												<p className="mt-1 truncate text-sm text-muted-foreground">
													{user.email}
												</p>
												{user.username ? (
													<p className="mt-1 truncate text-xs text-muted-foreground">
														@{user.username}
													</p>
												) : null}
											</div>
										</TableCell>
										<TableCell>
											<span
												className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getRoleStyles(
													user.role,
												)}`}
											>
												{formatRoleLabel(user.role)}
											</span>
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{formatScopeLabel(user)}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{formatDateTime(user.createdAt)}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{formatDateTime(user.lastLoginAt)}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{user.invitedByName || "—"}
										</TableCell>
									</TableRow>
								))}
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
