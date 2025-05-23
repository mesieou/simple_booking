"use client";

import { useState } from "react";
import { getOnboardingQuestions } from "@/lib/onboarding/getOnboardingQuestions";
import { useOnboardingContext } from "@/context/OnboardingContext";

type Props = {
  onFinish?: (answers: Record<string, string>) => void;
};

const OnboardingModal = ({ onFinish }: Props) => {
  const questions = getOnboardingQuestions();
  const { answers, setAnswers, resetAnswers } = useOnboardingContext();
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = questions[step];

  const handleSelect = (value: string) => {
    setAnswers((prev) => ({ ...prev, [current.key]: value }));
  };

  const handleNext = () => {
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      setFinished(true);
      if (onFinish) onFinish(answers);
    }
  };

  // Si finalizó, puedes mostrar un mensaje o simplemente bloquear el modal
  if (finished) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md flex flex-col items-center">
          <h2 className="text-xl font-semibold mb-2 text-center">¡Gracias!</h2>
          <p className="text-center text-gray-600">Tus respuestas han sido registradas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md flex flex-col items-center">
        <h2 className="text-xl font-semibold mb-4 text-center">{current.question}</h2>
        <div className="flex flex-col gap-3 w-full">
          {current.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`flex items-center gap-3 border rounded-md px-4 py-2 w-full text-left transition
                ${answers[current.key] === opt.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}
              `}
              aria-label={opt.label}
              tabIndex={0}
              onClick={() => handleSelect(opt.value)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSelect(opt.value)}
            >
              <span className="text-2xl">{opt.icon}</span>
              <span className="font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
        <button
          className="mt-6 w-full bg-blue-600 text-white rounded-md py-2 font-semibold disabled:opacity-50"
          onClick={handleNext}
          disabled={!answers[current.key]}
        >
          {step < questions.length - 1 ? "Siguiente" : "Finalizar"}
        </button>
      </div>
    </div>
  );
};

export default OnboardingModal; 