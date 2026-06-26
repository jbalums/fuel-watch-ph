import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

function getAnonId(): string {
  const key = "anon_presence_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function usePresenceTracker(user: User | null, pathname: string) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedAtRef = useRef(new Date().toISOString());

  useEffect(() => {
    const userId = user?.id ?? getAnonId();
    const email = user?.email ?? "Anonymous";
    const role = (user?.app_metadata?.role as string | undefined) ?? "user";

    const channel = supabase.channel("live-users", {
      config: { presence: { key: userId } },
    });

    channelRef.current = channel;

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: userId,
          email,
          role,
          page: pathname,
          joined_at: joinedAtRef.current,
        });
      }
    });

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    const userId = user?.id ?? getAnonId();
    const email = user?.email ?? "Anonymous";
    const role = (user?.app_metadata?.role as string | undefined) ?? "user";

    channel.track({
      user_id: userId,
      email,
      role,
      page: pathname,
      joined_at: joinedAtRef.current,
    });
  }, [pathname, user]);
}
