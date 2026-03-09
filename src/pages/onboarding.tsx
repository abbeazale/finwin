import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  getPageSession,
  getUserProfile,
  hasCompletedOnboarding,
} from "@/lib/page-auth";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";
import { FormEvent, useState, useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COMMON_CURRENCIES = [
  { value: "CAD", label: "CAD — Canadian Dollar", helper: "Amounts will be displayed in Canadian Dollar ($)" },
  { value: "USD", label: "USD — US Dollar", helper: "Amounts will be displayed in US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro", helper: "Amounts will be displayed in Euro (€)" },
  { value: "GBP", label: "GBP — British Pound", helper: "Amounts will be displayed in British Pound (£)" },
  { value: "AUD", label: "AUD — Australian Dollar", helper: "Amounts will be displayed in Australian Dollar ($)" },
];
const COMMON_TIMEZONES = [
  { value: "America/Toronto", label: "Toronto (ET) · UTC-5/4", helper: "America/Toronto" },
  { value: "America/Vancouver", label: "Vancouver (PT) · UTC-8/7", helper: "America/Vancouver" },
  { value: "America/New_York", label: "New York (ET) · UTC-5/4", helper: "America/New_York" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT) · UTC-8/7", helper: "America/Los_Angeles" },
  { value: "Europe/London", label: "London (GMT/BST) · UTC+0/1", helper: "Europe/London" },
];
const AGE_GROUPS = [
  { value: "18-24", label: "18-24", ageValue: "18" },
  { value: "25-34", label: "25-34", ageValue: "25" },
  { value: "35-44", label: "35-44", ageValue: "35" },
  { value: "45-54", label: "45-54", ageValue: "45" },
  { value: "55-64", label: "55-64", ageValue: "55" },
  { value: "65+", label: "65+", ageValue: "65" },
];

function splitDisplayName(name: string | null | undefined) {
  const normalizedName = name?.trim().replace(/\s+/g, " ") ?? "";

  if (!normalizedName) {
    return {
      firstName: "",
      lastName: "",
    };
  }

  const lastSpaceIndex = normalizedName.lastIndexOf(" ");

  if (lastSpaceIndex === -1) {
    return {
      firstName: normalizedName,
      lastName: "",
    };
  }

  return {
    firstName: normalizedName.slice(0, lastSpaceIndex),
    lastName: normalizedName.slice(lastSpaceIndex + 1),
  };
}

function capitalizeNameWords(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getAgeGroupValue(age: number | null | undefined) {
  if (typeof age !== "number") {
    return "";
  }

  if (age >= 65) {
    return "65+";
  }

  if (age >= 55) {
    return "55-64";
  }

  if (age >= 45) {
    return "45-54";
  }

  if (age >= 35) {
    return "35-44";
  }

  if (age >= 25) {
    return "25-34";
  }

  if (age >= 18) {
    return "18-24";
  }

  if (age >= 13) {
    return "13-17";
  }

  return "";
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
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const selectedAgeGroup = AGE_GROUPS.find((option) => option.value === age);

    if (!selectedAgeGroup) {
      setError("Select your age group.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          age: selectedAgeGroup.ageValue,
          currency,
          timezone,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Unable to save your profile.");
        return;
      }

      router.push("/dashboard");
    });
  }

  const selectedCurrency =
    COMMON_CURRENCIES.find((option) => option.value === currency) ?? COMMON_CURRENCIES[0];
  const selectedTimezone =
    COMMON_TIMEZONES.find((option) => option.value === timezone) ?? COMMON_TIMEZONES[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] items-start px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-8">
          <header className="flex flex-col gap-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#00d3f333] bg-[#00d3f31a] px-3 py-1 text-xs font-medium text-[#00d3f3]">
              <span className="size-1.5 rounded-full bg-[#00d3f3]" />
              Almost there
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="font-[family-name:var(--font-finwin-heading)] text-[2rem] font-semibold tracking-[-0.02em] text-white">
                Complete your profile
              </h1>
              <p className="text-sm text-[#6a7282]">
                Just a few details to personalize your FinWin experience
              </p>
            </div>
          </header>

          <FieldGroup className="gap-8">
            <div className="flex items-center gap-3">
              <span className="text-[11px] uppercase tracking-[0.08em] text-[#4a5565]">
                Personal
              </span>
              <div className="h-px flex-1 bg-white/6" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="onboarding-first-name" className="text-xs font-medium text-[#99a1af]">
                  First name
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="onboarding-first-name"
                    name="firstName"
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Alex"
                    autoComplete="given-name"
                    required
                    className="h-12 rounded-[14px] border-white/10 bg-white/4 px-4 text-[14px] text-white placeholder:text-[#4a5565]"
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="onboarding-last-name" className="text-xs font-medium text-[#99a1af]">
                  Last name
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="onboarding-last-name"
                    name="lastName"
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Johnson"
                    autoComplete="family-name"
                    required
                    className="h-12 rounded-[14px] border-white/10 bg-white/4 px-4 text-[14px] text-white placeholder:text-[#4a5565]"
                  />
                </FieldContent>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="onboarding-age" className="text-xs font-medium text-[#99a1af]">
                Age range
              </FieldLabel>
              <FieldContent>
                <Select value={age} onValueChange={setAge}>
                  <SelectTrigger
                    id="onboarding-age"
                    className="h-12 w-full rounded-[14px] border-white/10 bg-white/4 px-4 text-left text-[14px] text-white"
                  >
                    <SelectValue placeholder="Select your age group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Age groups</SelectLabel>
                      {AGE_GROUPS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
            <div className="flex items-center gap-3">
              <span className="text-[11px] uppercase tracking-[0.08em] text-[#4a5565]">
                Preferences
              </span>
              <div className="h-px flex-1 bg-white/6" />
            </div>

            <Field>
              <FieldLabel htmlFor="onboarding-currency" className="text-xs font-medium text-[#99a1af]">
                Preferred currency
              </FieldLabel>
              <FieldContent>
                <div className="relative">
                  <select
                    id="onboarding-currency"
                    name="currency"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    className="h-12 w-full appearance-none rounded-[14px] border border-white/10 bg-white/4 px-4 pr-12 text-[14px] font-medium text-[#d1d5dc] outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {COMMON_CURRENCIES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#4a5565]" />
                </div>
                <FieldDescription className="pl-1 text-[11px] text-[#4a5565]">
                  {selectedCurrency.helper}
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="onboarding-timezone" className="text-xs font-medium text-[#99a1af]">
                Timezone
              </FieldLabel>
              <FieldContent>
                <div className="relative">
                  <select
                    id="onboarding-timezone"
                    name="timezone"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    className="h-12 w-full appearance-none rounded-[14px] border border-white/10 bg-white/[0.04] px-4 pr-12 text-[14px] font-medium text-[#d1d5dc] outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {COMMON_TIMEZONES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#4a5565]" />
                </div>
                <FieldDescription className="pl-1 text-[11px] text-[#4a5565]">
                  {selectedTimezone.helper}
                </FieldDescription>
              </FieldContent>
            </Field>

            {error ? (
              <FieldDescription className="text-sm text-red-400">
                {error}
              </FieldDescription>
            ) : null}

            <Button
              type="submit"
              disabled={isPending}
              className="mt-1 h-[46px] w-full rounded-[14px] bg-lb text-[14px] font-medium text-black hover:bg-[#00d3f3]/90"
            >
              <Check data-icon="inline-start" />
              {isPending ? "Saving..." : "Complete setup"}
            </Button>
          </FieldGroup>
        </form>
      </div>
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
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  const profile = await getUserProfile(session.user.id);
  const parsedName = splitDisplayName(session.user.name);

  if (hasCompletedOnboarding(profile)) {
    return {
      redirect: {
        destination: "/dashboard",
        permanent: false,
      },
    };
  }

  return {
    props: {
      initialFirstName: capitalizeNameWords(
        profile?.firstName ?? parsedName.firstName,
      ),
      initialLastName: capitalizeNameWords(
        profile?.lastName ?? parsedName.lastName,
      ),
      initialAge: getAgeGroupValue(profile?.age),
      initialCurrency: profile?.currency ?? "CAD",
      initialTimezone: profile?.timezone ?? "America/Toronto",
    },
  };
};
