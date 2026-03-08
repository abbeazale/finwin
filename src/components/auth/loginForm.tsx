import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useState } from "react"

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div>
        <h1 className="justify-start text-4xl font-medium leading-10 tracking-tight">Welcome Back!</h1>
        <p className="mt-5 justify-start text-gray-500 text-md font-normal leading-5">Sign in to continue to Finwin.</p>
          <form className="mt-8">
            <FieldGroup>
            <Field className="flex w-1/2 flex-row xs:flex-col gap-4">
                <Button variant="outline" className="bg-slate-900 border-0.5 p-6 text-md text-white" type="button">
                  <Image src="/gitinverted.svg" alt="Github" width={30} height={30} className="mr-2 block group-hover:hidden" />
                   Github
                </Button>
                <Button variant="outline" className="bg-slate-900 border-0.5 p-6 text-md text-white" type="button">
                  <Image src="/google.svg" alt="Google" width={30} height={30} className="mr-2" />
                   Google
                </Button>
              </Field>
              <FieldSeparator >
                Or continue with email
              </FieldSeparator>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  className="bg-slate-900 border-none"
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input id="password" className="bg-slate-900 border-none" type="password" placeholder="enter password" required />
              </Field>
              <Field>
                <Button type="submit" className="h-11 relative bg-lb text-black hover:bg-lb rounded-md overflow-hidden">Login</Button>
                <FieldDescription className="text-center">
                Don&apos;t have an account? <a href="#" className="pointer-events-none">Sign up</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
      </div>
      
    </div>
  )
}
