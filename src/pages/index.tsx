import type { GetServerSideProps } from "next";
import {
  getPageSession,
  getUserProfile,
  hasCompletedOnboarding,
} from "@/lib/page-auth";

export default function Home() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getPageSession(context);

  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const profile = await getUserProfile(session.user.id);

  if (!hasCompletedOnboarding(profile)) {
    return { redirect: { destination: "/onboarding", permanent: false } };
  }

  return { redirect: { destination: "/dashboard", permanent: false } };
};
