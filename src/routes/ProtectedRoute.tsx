import { Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";

type ProtectedRouteProps = {
  children: React.ReactNode;
  session: Session | null;
};

function ProtectedRoute({
  children,
  session,
}: ProtectedRouteProps) {

  if (!session) {
    return <Navigate to="/" />;
  }

  return children;
}

export default ProtectedRoute;
