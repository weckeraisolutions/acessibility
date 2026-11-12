import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { SESSION_EXPIRED_EVENT } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const hadSession = useRef(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (session) hadSession.current = true;
    const onExpired = () => setExpired(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [session]);

  if (loading) {
    return (
      <div role="status" aria-label="Verificando sessão" className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const next = encodeURIComponent(location.pathname + location.search);
  if (expired || (!session && hadSession.current)) {
    return <main className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl" role="alert">Sua sessão expirou</h1>
      <p>Entre novamente para continuar. Alterações ainda não salvas precisam ser refeitas.</p>
      <button className="underline min-h-11" onClick={async () => { await supabase.auth.signOut({ scope: "local" }); navigate(`/auth?next=${next}`); }}>Entrar novamente</button>
    </main>;
  }
  if (!session) {
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
