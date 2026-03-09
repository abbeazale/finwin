import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useRouter } from "next/router";
import { FormEvent, useState, useTransition } from "react";
import { signIn } from "@/lib/auth-client";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const { error: signInError } = await signIn.email({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message ?? "Unable to sign in.");
        return;
      }

      await router.push("/dashboard");
    });
  }

  async function handleSocialSignIn(provider: "google" | "github") {
    setError(null);

    const { error: socialError } = await signIn.social({
      provider,
      callbackURL: "/dashboard",
    });

    if (socialError) {
      setError(socialError.message ?? "Unable to continue with social sign-in.");
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div>
        <h1 className="justify-start text-4xl font-medium leading-10 tracking-tight">
          Welcome Back!
        </h1>
        <p className="mt-5 justify-start text-gray-500 text-md font-normal leading-5">
          Sign in to continue to Finwin.
        </p>
        <form onSubmit={handleSubmit} className="mt-8">
          <FieldGroup>
            <Field className="grid w-full grid-cols-2 gap-3 sm:gap-4">
              <Button
                variant="outline"
                className="h-14 w-full bg-slate-900 border-0.5 px-3 text-base text-white sm:px-6"
                type="button"
                onClick={() => handleSocialSignIn("github")}
                disabled={isPending}
              >
                <Image
                  src="/gitinverted.svg"
                  alt="Github"
                  width={30}
                  height={30}
                  className="mr-2 h-7 w-7 sm:h-[30px] sm:w-[30px]"
                />
                Github
              </Button>
              <Button
                variant="outline"
                className="h-14 w-full bg-slate-900 border-0.5 px-3 text-base text-white sm:px-6"
                type="button"
                onClick={() => handleSocialSignIn("google")}
                disabled={isPending}
              >
                <Image
                  src="/google.svg"
                  alt="Google"
                  width={30}
                  height={30}
                  className="mr-2 h-7 w-7 sm:h-[30px] sm:w-[30px]"
                />
                Google
              </Button>
            </Field>
            <FieldSeparator>Or continue with email</FieldSeparator>
            <Field>
              <FieldLabel htmlFor="login-email">Email</FieldLabel>
              <Input
                className="bg-slate-900 border-none"
                id="login-email"
                name="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <Input
                id="login-password"
                name="password"
                className="bg-slate-900 border-none"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
            {error ? (
              <FieldDescription className="text-sm text-red-400">
                {error}
              </FieldDescription>
            ) : null}
            <Field>
              <Button
                type="submit"
                disabled={isPending}
                className="h-11 relative bg-lb text-black hover:bg-lb rounded-md overflow-hidden"
              >
                {isPending ? "Signing in..." : "Login"}
              </Button>
              <FieldDescription className="text-center">
                Don&apos;t have an account? Use the toggle above to create one.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}
