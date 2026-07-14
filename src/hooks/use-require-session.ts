import { useRouter } from "next/router";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";

export function useRequireSession() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const isAuthenticated = Boolean(session);

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      void router.replace("/login");
    }
  }, [isAuthenticated, isPending, router]);

  return { session, isPending };
}
