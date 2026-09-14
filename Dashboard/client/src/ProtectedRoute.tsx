import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import { Redirect } from "wouter";

interface Props {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const { isLoading, error } = useQuery({
    queryKey: ["auth-check"],
    queryFn: () => apiFetch("/api/auth/me"),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}
