import { Button } from "@/components/ui/button";
import LoginForm from "@/components/auth/loginForm";
import SignupComponent from "@/components/auth/signupForm";
import { useState } from "react";

export default function Login() {
  const [activePage, setActivePage] = useState<"signin" | "signup">("signin");

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-background">
      
      {/* Toggle */}
      <div className="relative mt-10 flex w-1/2 lg:w-1/3  rounded-md bg-slate-900 p-1 overflow-hidden">
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
      <div className="w-1/2 lg:w-1/3 mt-10 text-white">
        {activePage === "signin" ? <LoginForm /> : <SignupComponent />}
      </div>

    </div>
  );
}