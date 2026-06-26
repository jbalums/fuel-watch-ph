import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { usePresence } from "@/contexts/PresenceContext";
import { useUserAccess } from "@/hooks/useUserAccess";

function useElapsedTime(joinedAt: string) {
	const [elapsed, setElapsed] = useState(() => getElapsed(joinedAt));

	useEffect(() => {
		const interval = setInterval(() => {
			setElapsed(getElapsed(joinedAt));
		}, 1000);
		return () => clearInterval(interval);
	}, [joinedAt]);

	return elapsed;
}

function getElapsed(joinedAt: string): string {
	const seconds = Math.floor(
		(Date.now() - new Date(joinedAt).getTime()) / 1000,
	);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ${minutes % 60}m`;
}

function formatPage(page: string): string {
	if (page === "/") return "Home";
	return page;
}

function formatRole(role: string): string {
	return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ElapsedCell({ joinedAt }: { joinedAt: string }) {
	const elapsed = useElapsedTime(joinedAt);
	return <span className="tabular-nums">{elapsed}</span>;
}

export default function AdminLiveUsersPage() {
	const { isSuperAdmin } = useUserAccess();
	const { users, count } = usePresence();

	if (!isSuperAdmin) {
		return (
			<div className="rounded-2xl bg-card p-6 shadow-sovereign">
				<p className="text-sm text-muted-foreground">
					Super admin access required.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center gap-3">
				<div className="relative flex items-center">
					<span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-success opacity-75" />
					<span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
				</div>
				<h3 className="text-headline text-foreground">
					{count} {count === 1 ? "user" : "users"} online
				</h3>
			</div>

			<div className="rounded-2xl bg-card shadow-sovereign overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Email</TableHead>
							<TableHead>Page</TableHead>
							<TableHead>Role</TableHead>
							<TableHead className="text-right">Time Online</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{users.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={4}
									className="py-10 text-center text-sm text-muted-foreground"
								>
									<Users className="mx-auto mb-2 h-6 w-6 opacity-40" />
									No active users detected yet.
								</TableCell>
							</TableRow>
						) : (
							users
								.slice()
								.sort(
									(a, b) =>
										new Date(a.joined_at).getTime() -
										new Date(b.joined_at).getTime(),
								)
								.map((u) => (
									<TableRow key={u.user_id}>
										<TableCell className="font-medium">
											{u.email}
										</TableCell>
										<TableCell className="text-muted-foreground font-mono text-sm">
											{formatPage(u.page)}
										</TableCell>
										<TableCell>
											<Badge
												variant="secondary"
												className="text-xs capitalize"
											>
												{formatRole(u.role)}
											</Badge>
										</TableCell>
										<TableCell className="text-right text-sm text-muted-foreground">
											<ElapsedCell joinedAt={u.joined_at} />
										</TableCell>
									</TableRow>
								))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
