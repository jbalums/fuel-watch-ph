import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2, RefreshCw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { usePresence, type PresenceHistoryEntry } from "@/contexts/PresenceContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useEffect } from "react";

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

function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ${minutes % 60}m`;
}

function formatDateTime(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

function formatPage(page: string): string {
	if (page === "/") return "Home";
	return page;
}

function formatRole(role: string): string {
	return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseBrowser(ua: string): string {
	if (/Edg\//.test(ua)) return "Edge";
	if (/OPR\/|Opera/.test(ua)) return "Opera";
	if (/Chrome\//.test(ua)) return /Mobile/.test(ua) ? "Chrome Mobile" : "Chrome";
	if (/Firefox\//.test(ua)) return "Firefox";
	if (/Safari\//.test(ua)) return /Mobile/.test(ua) ? "Safari Mobile" : "Safari";
	return "Unknown";
}

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

function ElapsedCell({ joinedAt }: { joinedAt: string }) {
	const elapsed = useElapsedTime(joinedAt);
	return <span className="tabular-nums">{elapsed}</span>;
}

function usePresenceHistory(enabled: boolean) {
	return useQuery<PresenceHistoryEntry[]>({
		queryKey: ["presence_history"],
		enabled,
		queryFn: async () => {
			const { data, error } = await (supabase as any)
				.from("presence_history")
				.select("*")
				.order("end_time", { ascending: false })
				.limit(500);
			if (error) throw error;
			return (data ?? []) as PresenceHistoryEntry[];
		},
	});
}

export default function AdminLiveUsersPage() {
	const { isSuperAdmin } = useUserAccess();
	const { users, count, refresh } = usePresence();
	const [historyOpen, setHistoryOpen] = useState(false);

	const {
		data: history = [],
		isLoading: historyLoading,
		refetch: refetchHistory,
	} = usePresenceHistory(isSuperAdmin && historyOpen);

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
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="relative flex items-center">
						<span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-success opacity-75" />
						<span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
					</div>
					<h3 className="text-headline text-foreground">
						{count} {count === 1 ? "user" : "users"} online
					</h3>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={refresh}>
						<RefreshCw className="mr-1.5 h-4 w-4" />
						Refresh
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setHistoryOpen(true)}
					>
						<History className="mr-1.5 h-4 w-4" />
						History
					</Button>
				</div>
			</div>

			<div className="overflow-hidden rounded-2xl bg-card shadow-sovereign">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Email</TableHead>
							<TableHead>Page</TableHead>
							<TableHead>Host</TableHead>
							<TableHead>Browser</TableHead>
							<TableHead>Role</TableHead>
							<TableHead className="text-right">Time Online</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{users.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={6}
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
										<TableCell className="font-mono text-sm text-muted-foreground">
											{formatPage(u.page)}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{u.host ?? "—"}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{u.user_agent ? parseBrowser(u.user_agent) : "—"}
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

			<Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
				<DialogContent className="max-h-[80vh] max-w-5xl overflow-y-auto">
					<DialogHeader className="flex flex-row items-center justify-between pr-8">
						<DialogTitle>Session History</DialogTitle>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => refetchHistory()}
							disabled={historyLoading}
						>
							<RefreshCw className={`h-4 w-4 ${historyLoading ? "animate-spin" : ""}`} />
						</Button>
					</DialogHeader>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead>Page</TableHead>
								<TableHead>Host</TableHead>
								<TableHead>Browser</TableHead>
								<TableHead>Start Time</TableHead>
								<TableHead>End Time</TableHead>
								<TableHead>Duration</TableHead>
								<TableHead>Role</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{historyLoading ? (
								<TableRow>
									<TableCell
										colSpan={8}
										className="py-10 text-center text-sm text-muted-foreground"
									>
										<Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin opacity-40" />
										Loading history…
									</TableCell>
								</TableRow>
							) : history.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={8}
										className="py-10 text-center text-sm text-muted-foreground"
									>
										<History className="mx-auto mb-2 h-6 w-6 opacity-40" />
										No session history yet.
									</TableCell>
								</TableRow>
							) : (
								history.map((entry, i) => (
									<TableRow
										key={`${entry.user_id}-${entry.start_time}-${i}`}
									>
										<TableCell className="font-medium">
											{entry.email}
										</TableCell>
										<TableCell className="font-mono text-sm text-muted-foreground">
											{formatPage(entry.page)}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{entry.host || "—"}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{entry.user_agent
												? parseBrowser(entry.user_agent)
												: "—"}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{formatDateTime(entry.start_time)}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{formatDateTime(entry.end_time)}
										</TableCell>
										<TableCell className="tabular-nums text-sm">
											{formatDuration(entry.duration_seconds)}
										</TableCell>
										<TableCell>
											<Badge
												variant="secondary"
												className="text-xs capitalize"
											>
												{formatRole(entry.role)}
											</Badge>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</DialogContent>
			</Dialog>
		</div>
	);
}
