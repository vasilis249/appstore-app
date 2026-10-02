import { createFileRoute, Navigate, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useIsStudent } from "@/hooks/use-is-student";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: StudentGate,
});

/** Students only: an account that hasn't verified its academic email sees just the verification steps. */
function StudentGate() {
  const student = useIsStudent();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (student === false && path !== "/student") return <Navigate to="/student" search={{ welcome: 1 }} replace />;
  if (student === undefined && path !== "/student") return null;
  return <Outlet />;
}
