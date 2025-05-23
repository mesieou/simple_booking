"use client";

import { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from "react";

export type OnboardingAnswersType = Record<string, string>;

interface OnboardingContextType {
  answers: OnboardingAnswersType;
  setAnswers: Dispatch<SetStateAction<OnboardingAnswersType>>;
  resetAnswers: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const [answers, setAnswers] = useState<OnboardingAnswersType>({});

  const resetAnswers = () => setAnswers({});

  return (
    <OnboardingContext.Provider value={{ answers, setAnswers, resetAnswers }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboardingContext = () => {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error("useOnboardingContext debe usarse dentro de OnboardingProvider");
  return context;
}; 