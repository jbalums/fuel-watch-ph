import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LiveUserPresence {
  user_id: string;
  email: string;
  role: string;
  page: string;
  joined_at: string;
}

export function useLiveUsers() {
  const [users, setUsers] = useState<LiveUserPresence[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase.channel("live-users");
    channelRef.current = channel;

    const syncUsers = () => {
      const state = channel.presenceState<LiveUserPresence>();
      const deduplicated = Object.values(state)
        .flat()
        .reduce<Map<string, LiveUserPresence>>((acc, presence) => {
          const existing = acc.get(presence.user_id);
          if (!existing || presence.joined_at > existing.joined_at) {
            acc.set(presence.user_id, presence);
          }
          return acc;
        }, new Map());

      setUsers(Array.from(deduplicated.values()));
    };

    channel
      .on("presence", { event: "sync" }, syncUsers)
      .on("presence", { event: "join" }, syncUsers)
      .on("presence", { event: "leave" }, syncUsers);

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return { users, count: users.length };
}
