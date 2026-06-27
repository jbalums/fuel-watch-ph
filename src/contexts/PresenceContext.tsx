import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface LiveUserPresence {
	user_id: string;
	email: string;
	role: string;
	page: string;
	joined_at: string;
	host: string;
	user_agent: string;
}

export interface PresenceHistoryEntry {
	user_id: string;
	email: string;
	role: string;
	page: string;
	host: string;
	user_agent: string | null;
	start_time: string;
	end_time: string;
	duration_seconds: number;
}

interface PresenceContextValue {
	users: LiveUserPresence[];
	count: number;
	refresh: () => void;
}

const PresenceContext = createContext<PresenceContextValue>({
	users: [],
	count: 0,
	refresh: () => {},
});

export const usePresence = () => useContext(PresenceContext);

function getAnonId(): string {
	const key = "anon_presence_id";
	let id = sessionStorage.getItem(key);
	if (!id) {
		id = crypto.randomUUID();
		sessionStorage.setItem(key, id);
	}
	return id;
}

export function PresenceProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth();
	const { pathname } = useLocation();
	const [users, setUsers] = useState<LiveUserPresence[]>([]);
	const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
	const syncStateRef = useRef<(() => void) | null>(null);
	const joinedAtRef = useRef(new Date().toISOString());
	const pathnameRef = useRef(pathname);
	pathnameRef.current = pathname;

	useEffect(() => {
		const userId = user?.id ?? getAnonId();
		const email = user?.email ?? "Anonymous";
		const role =
			(user?.app_metadata?.role as string | undefined) ?? "user";

		const channel = supabase.channel("live-users", {
			config: { presence: { key: userId } },
		});

		channelRef.current = channel;

		const syncState = () => {
			const state = channel.presenceState<LiveUserPresence>();
			const deduped = Object.values(state)
				.flat()
				.reduce<Map<string, LiveUserPresence>>((acc, p) => {
					const existing = acc.get(p.user_id);
					if (!existing || p.joined_at > existing.joined_at) {
						acc.set(p.user_id, p);
					}
					return acc;
				}, new Map());
			setUsers(Array.from(deduped.values()));
		};

		syncStateRef.current = syncState;

		channel
			.on("presence", { event: "sync" }, syncState)
			.on("presence", { event: "join" }, syncState)
			.on(
				"presence",
				{ event: "leave" },
				({
					leftPresences,
				}: {
					leftPresences: Record<string, LiveUserPresence[]>;
				}) => {
					const endTime = new Date().toISOString();
					const rows = Object.values(leftPresences)
						.flat()
						.map((p) => ({
							user_id: p.user_id,
							email: p.email,
							role: p.role,
							page: p.page,
							host: p.host ?? "",
							user_agent: p.user_agent ?? null,
							start_time: p.joined_at,
							end_time: endTime,
							duration_seconds: Math.max(
								0,
								Math.floor(
									(Date.now() -
										new Date(p.joined_at).getTime()) /
										1000,
								),
							),
						}));

					if (rows.length > 0) {
						// Fire-and-forget; unique constraint on (user_id, start_time)
						// prevents duplicates when multiple clients record the same leave event.
						supabase
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							.from("presence_history" as any)
							.upsert(rows, {
								onConflict: "user_id,start_time",
								ignoreDuplicates: true,
							})
							.then(() => {});
					}

					syncState();
				},
			)
			.subscribe(async (status) => {
				if (status === "SUBSCRIBED") {
					await channel.track({
						user_id: userId,
						email,
						role,
						page: pathnameRef.current,
						joined_at: joinedAtRef.current,
						host: window.location.host,
						user_agent: navigator.userAgent,
					});
				}
			});

		return () => {
			channel.unsubscribe();
			supabase.removeChannel(channel);
		};
	}, [user?.id]);

	useEffect(() => {
		const channel = channelRef.current;
		if (!channel) return;

		const userId = user?.id ?? getAnonId();
		const email = user?.email ?? "Anonymous";
		const role =
			(user?.app_metadata?.role as string | undefined) ?? "user";

		channel.track({
			user_id: userId,
			email,
			role,
			page: pathname,
			joined_at: joinedAtRef.current,
			host: window.location.host,
			user_agent: navigator.userAgent,
		});
	}, [pathname, user]);

	const refresh = useCallback(() => {
		syncStateRef.current?.();
	}, []);

	return (
		<PresenceContext.Provider value={{ users, count: users.length, refresh }}>
			{children}
		</PresenceContext.Provider>
	);
}
