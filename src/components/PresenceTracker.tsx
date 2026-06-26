import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePresenceTracker } from "@/hooks/usePresenceTracker";

export function PresenceTracker() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  usePresenceTracker(user, pathname);
  return null;
}
