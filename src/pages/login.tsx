
import { Button } from "@/components/ui/button";
import { useState } from "react";



export default function Login() {
  const [activePage, setActivePage] = useState<"signin" | "signup">("signin");

  function handlePageChange(page: "signin" | "signup") {
    setActivePage(page);
  }

  return (
    <div className="flex w-full bg-background justify-center h-screen ">
      <div className="relative mt-10 flex h-auto w-1/2 self-start rounded-md bg-slate-900 p-1">
        <div
          className={`absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-md bg-lb hover:bg-lb transition-transform duration-300 ease-out ${
            activePage === "signin" ? "translate-x-0" : "translate-x-full"
          }`}
          aria-hidden="true"
        />

        <Button
          className={`relative z-10 w-1/2 justify-center bg-transparent transition-colors duration-300 ${
            activePage === "signin" ? "text-black hover:bg-lb" : "text-white"
          }`}
          onClick={() => handlePageChange("signin")}
        >
          Sign in
        </Button>

        <Button
          className={`relative z-10 w-1/2 justify-center bg-transparent transition-colors duration-300 ${
            activePage === "signup" ? "text-black hover:bg-lb" : "text-white"
          }`}
          onClick={() => handlePageChange("signup")}
        >
          Create an account
        </Button>
      </div>
    </div>
  );
}
