export type OnboardingOption = {
  value: string;
  label: string;
  icon: string;
};

export type OnboardingQuestion = {
  key: string;
  question: string;
  options: OnboardingOption[];
};

export const getOnboardingQuestions = (): OnboardingQuestion[] => [
  {
    key: "role",
    question: "¿Cuál es tu rol?",
    options: [
      { value: "finance", label: "Finanzas", icon: "💰" },
      { value: "sales", label: "Ventas", icon: "📈" },
      { value: "customer_success", label: "Atención al cliente", icon: "💖" },
      { value: "recruiting", label: "Reclutamiento", icon: "📋" },
    ],
  },
  {
    key: "frequency",
    question: "¿Con qué frecuencia usas este sistema?",
    options: [
      { value: "daily", label: "Diario", icon: "🕐" },
      { value: "weekly", label: "Semanal", icon: "📅" },
      { value: "monthly", label: "Mensual", icon: "🗓️" },
      { value: "as_needed", label: "Solo cuando lo necesito", icon: "��" },
    ],
  },
]; 