import { Button } from "@/components/ui/button";
import LoginForm from "@/components/auth/loginForm";
import SignupComponent from "@/components/auth/signupForm";
import { useState } from "react";
import type { GetServerSideProps } from "next";
import {
  getPageSession,
  getUserProfile,
  hasCompletedOnboarding,
} from "@/lib/page-auth";

export default function Login() {
  const [activePage, setActivePage] = useState<"signin" | "signup">("signin");

  return (
    <div className="flex w-full min-h-screen flex-col items-center bg-background px-4 pb-10">
      {/* Toggle */}
      <div className="relative mt-10 flex w-full max-w-2xl overflow-hidden rounded-md bg-slate-900 p-1">
        <div
          className={`absolute inset-1 w-[calc(50%-0.25rem)] rounded-md bg-lb transition-transform duration-300 ease-out ${
            activePage === "signin" ? "translate-x-0" : "translate-x-full"
          }`}
          aria-hidden="true"
        />
        <Button
          variant="ghost"
          className={`relative z-10 w-1/2 bg-transparent hover:bg-transparent transition-colors duration-300 ${
            activePage === "signin" ? "text-black hover:text-black" : "text-white hover:text-white"
          }`}
          onClick={() => setActivePage("signin")}
        >
          Sign in
        </Button>
        <Button
          variant="ghost"
          className={`relative z-10 w-1/2 bg-transparent hover:bg-transparent transition-colors duration-300 ${
            activePage === "signup" ? "text-black hover:text-black" : "text-white hover:text-white"
          }`}
          onClick={() => setActivePage("signup")}
        >
          Create an account
        </Button>
      </div>

      {/* Form */}
      <div className="mt-10 w-full max-w-2xl text-white">
        {activePage === "signin" ? <LoginForm /> : <SignupComponent />}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getPageSession(context);

  if (!session) {
    return { props: {} };
  }

  const profile = await getUserProfile(session.user.id);

  if (hasCompletedOnboarding(profile)) {
    return {
      redirect: {
        destination: "/dashboard",
        permanent: false,
      },
    };
  }

  return {
    redirect: {
      destination: "/onboarding",
      permanent: false,
    },
  };
};
