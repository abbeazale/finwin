import { useRouter } from "next/router";
import { useState, useTransition, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";

/**
 * The room every signed-in page sits in: warm light, the sidebar, and a
 * sticky top bar. Pages add their own buttons to the bar through `actions`.
 */
export function AppShell({
  firstName,
  actions,
  children,
}: {
  firstName?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const name = firstName ?? session?.user.name.split(" ")[0] ?? "";
  const initials = name.slice(0, 2).toUpperCase() || "··";

  function logout() {
    setLogoutError(null);
    startTransition(async () => {
      const { error } = await signOut();
      if (error) {
        setLogoutError(error.message ?? "Unable to log out.");
        return;
      }
      router.push("/login");
    });
  }

  return (
    <div className="relative min-h-screen bg-ink-0 text-bone">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute -top-56 right-[6%] h-[42rem] w-[42rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(232,199,145,0.08), transparent 66%)",
          }}
        />
        <div
          className="absolute -bottom-64 left-[-10%] h-[46rem] w-[64rem] blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse, rgba(255,154,60,0.06), transparent 62%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-64"
          style={{
            background:
              "linear-gradient(0deg, rgba(255,154,60,0.04), transparent 100%)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1480px]">
        <DashboardSidebar
          firstName={name}
          initials={initials}
          isPending={isPending}
          currentPath={router.pathname}
          onLogout={logout}
        />

        <main className="min-w-0 flex-1">
          <DashboardHeader
            firstName={name}
            initials={initials}
            isPending={isPending}
            currentPath={router.pathname}
            onLogout={logout}
            actions={actions}
          />

          <div className="px-6 py-10 lg:px-10 lg:py-12">
            {logoutError ? (
              <Alert variant="destructive" className="mb-6 rounded-[14px]">
                <TriangleAlert />
                <AlertDescription>{logoutError}</AlertDescription>
              </Alert>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
