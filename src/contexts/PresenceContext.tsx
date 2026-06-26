import {
	createContext,
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
}

interface PresenceContextValue {
	users: LiveUserPresence[];
	count: number;
}

const PresenceContext = createContext<PresenceContextValue>({
	users: [],
	count: 0,
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

		channel
			.on("presence", { event: "sync" }, syncState)
			.on("presence", { event: "join" }, syncState)
			.on("presence", { event: "leave" }, syncState)
			.subscribe(async (status) => {
				if (status === "SUBSCRIBED") {
					await channel.track({
						user_id: userId,
						email,
						role,
						page: pathnameRef.current,
						joined_at: joinedAtRef.current,
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
		});
	}, [pathname, user]);

	return (
		<PresenceContext.Provider value={{ users, count: users.length }}>
			{children}
		</PresenceContext.Provider>
	);
}
