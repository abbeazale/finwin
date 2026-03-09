import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import {
  getPageSession,
  getUserProfile,
  hasCompletedOnboarding,
} from "@/lib/page-auth";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/router";
import { useState, useTransition } from "react";

export default function Dashboard({
  firstName,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function logout() {
    setError(null);

    startTransition(async () => {
      const { error: signOutError } = await signOut();

      if (signOutError) {
        setError(signOutError.message ?? "Unable to log out.");
        return;
      }

      console.log("signedout")
      router.push("/login");
    });
  }

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center text-white">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/70 p-10 text-center shadow-[0_30px_80px_-30px_rgba(65,210,255,0.35)]">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300/70">
          Dashboard
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          Welcome, {firstName}.
        </h1>
        <p className="mt-4 text-slate-300">
          Your authenticated flow is wired. Next step is replacing this placeholder
          with the real FinWin dashboard experience.
        </p>
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        <Button onClick={logout} disabled={isPending}>
          {isPending ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<{
  firstName: string;
}> = async (context) => {
  const session = await getPageSession(context);

  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  const profile = await getUserProfile(session.user.id);

  if (!hasCompletedOnboarding(profile)) {
    return {
      redirect: {
        destination: "/onboarding",
        permanent: false,
      },
    };
  }

  return {
    props: {
      firstName: profile?.firstName ?? "there",
    },
  };
};
