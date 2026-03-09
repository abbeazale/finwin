import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useRouter } from "next/router";
import { FormEvent, useState, useTransition } from "react";
import { signIn, signUp } from "@/lib/auth-client";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleEmailSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Enter your name to create an account.");
      return;
    }

    startTransition(async () => {
      const { error: signUpError } = await signUp.email({
        email,
        password,
        name: trimmedName,
      });

      if (signUpError) {
        setError(signUpError.message ?? "Unable to create your account.");
        return;
      }

       router.push("/onboarding");
    });
  }

  async function handleSocialSignup(provider: "google" | "github") {
    setError(null);

    const { error: socialError } = await signIn.social({
      provider,
      callbackURL: "/onboarding",
    });

    if (socialError) {
      setError(socialError.message ?? "Unable to continue with social sign-up.");
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div>
        <h1 className="justify-start text-4xl font-medium leading-10 tracking-tight">
          Create your account!
        </h1>
        <p className="mt-5 justify-start text-gray-500 text-md font-normal leading-5">
          Start building better money habits today.
        </p>
        <form onSubmit={handleEmailSignup} className="mt-8">
          <FieldGroup>
            <Field className="flex w-1/2 flex-row gap-4 xs:flex-col">
              <Button
                variant="outline"
                className="bg-slate-900 border-0.5 p-6 text-md text-white"
                type="button"
                onClick={() => handleSocialSignup("github")}
                disabled={isPending}
              >
                <Image
                  src="/gitinverted.svg"
                  alt="Github"
                  width={30}
                  height={30}
                  className="mr-2 block group-hover:hidden"
                />
                <Image
                  src="/github.svg"
                  alt="Github"
                  width={30}
                  height={30}
                  className="mr-2 hidden group-hover:block"
                />
                Github
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSocialSignup("google")}
                className="bg-slate-900 border-0.5 p-6 text-md text-white"
                type="button"
                disabled={isPending}
              >
                <Image
                  src="/google.svg"
                  alt="Google"
                  width={30}
                  height={30}
                  className="mr-2 "
                />
                Google
              </Button>
            </Field>
            <FieldSeparator>Or continue with email</FieldSeparator>
            <Field>
              <FieldLabel htmlFor="signup-name">Name</FieldLabel>
              <Input
                className="bg-slate-900 border-none"
                id="signup-name"
                name="name"
                onChange={(event) => setName(event.target.value)}
                value={name}
                type="text"
                placeholder="Alex Morgan"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="signup-email">Email</FieldLabel>
              <Input
                className="bg-slate-900 border-none"
                id="signup-email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                value={email}
                type="email"
                placeholder="m@example.com"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="signup-password">Password</FieldLabel>
              <Input
                id="signup-password"
                name="password"
                className="bg-slate-900 border-none"
                type="password"
                placeholder="Create a password"
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
                {isPending ? "Creating account..." : "Create account"}
              </Button>
              <FieldDescription className="text-center">
                Already have an account? Use the toggle above to sign in.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}
