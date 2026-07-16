import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPageSession,
  getUserProfile,
  hasCompletedOnboarding,
} from "@/lib/page-auth";
import { COMMON_CURRENCIES, COMMON_TIMEZONES, resolveProfileTimeZone } from "@/lib/locale";
import { capitalizeNameWords } from "@/lib/name";
import { trpc } from "@/lib/trpc";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";
import { FormEvent, useState } from "react";

function splitDisplayName(name: string | null | undefined) {
  const normalizedName = name?.trim().replace(/\s+/g, " ") ?? "";
  if (!normalizedName) return { firstName: "", lastName: "" };
  const lastSpaceIndex = normalizedName.lastIndexOf(" ");
  if (lastSpaceIndex === -1) return { firstName: normalizedName, lastName: "" };
  return {
    firstName: normalizedName.slice(0, lastSpaceIndex),
    lastName: normalizedName.slice(lastSpaceIndex + 1),
  };
}

export default function OnboardingPage({
  initialFirstName,
  initialLastName,
  initialAge,
  initialCurrency,
  initialTimezone,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [age, setAge] = useState(initialAge);
  const [currency, setCurrency] = useState(initialCurrency);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [error, setError] = useState<string | null>(null);
  const completeOnboarding = trpc.onboarding.complete.useMutation();
  const isPending = completeOnboarding.isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await completeOnboarding.mutateAsync({ firstName, lastName, age, currency, timezone });
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save your profile.");
    }
  };

  const selectedCurrency =
    COMMON_CURRENCIES.find((option) => option.value === currency) ?? COMMON_CURRENCIES[0];
  const selectedTimezone =
    COMMON_TIMEZONES.find((option) => option.value === timezone) ?? COMMON_TIMEZONES[0];

  const steps = [
    { k: "01", label: "Identity", active: true },
    { k: "02", label: "Locale", active: true },
    { k: "03", label: "Desk", active: false },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-0 text-bone">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 right-[20%] h-[32rem] w-[32rem] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(232,199,145,0.06), transparent 65%)" }} />
        <div className="absolute -bottom-40 left-[10%] h-[32rem] w-[48rem] blur-3xl" style={{ background: "radial-gradient(ellipse, rgba(255,154,60,0.05), transparent 60%)" }} />
        <div className="grid-plan absolute inset-0 opacity-[0.2] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,#000,transparent_80%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <span className="display text-[22px] leading-none text-bone">
            Fin<span className="italic text-brass">Win</span>
          </span>
          <span className="label-eyebrow">Form · 02 / 03</span>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-1">
          {steps.map((s) => (
            <div key={s.k} className="flex flex-col gap-2">
              <div
                className="h-[2px] rounded-[1px]"
                style={{
                  background: s.active
                    ? "linear-gradient(90deg, var(--brass-hi), var(--brass))"
                    : "var(--stroke-2)",
                  boxShadow: s.active ? "0 0 12px -2px var(--brass-glow)" : "none",
                }}
              />
              <div className="flex items-baseline justify-between">
                <span className="num text-[10px] text-bone-faint">{s.k}</span>
                <span className={`label-eyebrow ${s.active ? "text-brass-hi" : ""}`}>{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        <main className="mt-16 animate-fade-slide">
          <span className="label-eyebrow-brass">§ Almost there</span>
          <h1 className="display mt-4 text-[clamp(2.2rem,4vw,3.2rem)] leading-[1.02] text-bone">
            Set up your <span className="italic text-brass-hi">desk.</span>
          </h1>
          <p className="mt-4 max-w-md text-[13px] leading-[1.7] text-bone-mute">
            A few details so account data, budgets, and month boundaries use the right locale.
          </p>

          <form onSubmit={handleSubmit} className="mt-12 flex flex-col gap-12">
            <section className="flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <span className="label-eyebrow-brass">§ Identity</span>
                <span className="h-px flex-1 bg-[var(--stroke)]" />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="First name">
                  <input
                    id="onboarding-first-name"
                    name="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alex"
                    autoComplete="given-name"
                    required
                    className="input-arch"
                  />
                </Field>
                <Field label="Last name">
                  <input
                    id="onboarding-last-name"
                    name="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Morgan"
                    autoComplete="family-name"
                    required
                    className="input-arch"
                  />
                </Field>
              </div>

              <Field label="Age" helper="Required for profile setup.">
                <input
                  id="onboarding-age"
                  name="age"
                  type="number"
                  min={13}
                  max={120}
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="28"
                  required
                  className="input-arch num [&::-webkit-inner-spin-button]:appearance-none"
                />
              </Field>
            </section>

            <section className="flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <span className="label-eyebrow-brass">§ Locale</span>
                <span className="h-px flex-1 bg-[var(--stroke)]" />
              </div>

              <Field label="Currency" helper={selectedCurrency.helper}>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger
                    id="onboarding-currency"
                    className="input-arch flex h-11 w-full items-center justify-between rounded-[2px] text-left"
                  >
                    <SelectValue placeholder="Select your currency" />
                  </SelectTrigger>
                  <SelectContent className="border-[var(--stroke-2)] bg-[var(--ink-1)]">
                    <SelectGroup className="max-h-60 overflow-y-auto">
                      <SelectLabel className="label-eyebrow">Currencies</SelectLabel>
                      {COMMON_CURRENCIES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Timezone" helper={selectedTimezone.helper}>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger
                    id="onboarding-timezone"
                    className="input-arch flex h-11 w-full items-center justify-between rounded-[2px] text-left"
                  >
                    <SelectValue placeholder="Select your timezone" />
                  </SelectTrigger>
                  <SelectContent className="border-[var(--stroke-2)] bg-[var(--ink-1)]">
                    <SelectGroup className="max-h-60 overflow-y-auto">
                      <SelectLabel className="label-eyebrow">Timezones</SelectLabel>
                      {COMMON_TIMEZONES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </section>

            {error ? (
              <p className="rounded-[2px] border border-[rgba(194,106,72,0.3)] bg-[rgba(194,106,72,0.08)] px-3 py-2 text-[12px] text-oxide-hi">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-[var(--stroke)] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-bone-faint">
                You can revise these later in settings.
              </p>
              <Button
                type="submit"
                variant="ghost"
                disabled={isPending}
                className="btn-brass h-12 justify-center disabled:opacity-60"
              >
                {isPending ? "Warming the tungsten…" : "Complete setup"}
                <span aria-hidden>→</span>
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label-eyebrow">{label}</span>
      {children}
      {helper ? <span className="text-[11px] text-bone-faint">{helper}</span> : null}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<{
  initialFirstName: string;
  initialLastName: string;
  initialAge: string;
  initialCurrency: string;
  initialTimezone: string;
}> = async (context) => {
  const session = await getPageSession(context);

  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const profile = await getUserProfile(session.user.id);
  const parsedName = splitDisplayName(session.user.name);

  if (hasCompletedOnboarding(profile)) {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  return {
    props: {
      initialFirstName: capitalizeNameWords(profile?.firstName ?? parsedName.firstName),
      initialLastName: capitalizeNameWords(profile?.lastName ?? parsedName.lastName),
      initialAge: profile?.age ? String(profile.age) : "",
      initialCurrency: profile?.currency ?? "CAD",
      initialTimezone: resolveProfileTimeZone(profile?.timezone),
    },
  };
};
