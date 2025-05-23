import { OnboardingProvider } from "@/context/OnboardingContext";
import OnboardingModal from "@/components/OnboardingModal";

export default function ProtectedPage() {
  return (
    <OnboardingProvider>
      <OnboardingModal />
    </OnboardingProvider>
  );
}
