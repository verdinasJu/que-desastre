import { redirectIfOnboardingComplete } from "@/lib/onboarding-guard";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectIfOnboardingComplete();
  return children;
}
