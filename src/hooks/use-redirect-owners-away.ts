import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

/**
 * Owners (who are not also admins) should never reach player-flow pages.
 * Redirects them to the owner dashboard from the client.
 */
export function useRedirectOwnersAway() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (role === "owner") {
      navigate({ to: "/owner", replace: true });
    }
  }, [role, loading, navigate]);
}
