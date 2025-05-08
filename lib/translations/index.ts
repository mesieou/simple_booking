import { en } from './en';
import { es } from './es';

export type Language = 'en' | 'es';

export type TranslationKey = 
  | keyof typeof en.nav 
  | keyof typeof en.form 
  | keyof typeof en.message 
  | keyof typeof en.pricing
  | keyof typeof en.about
  | keyof typeof en.footer
  | keyof typeof en.hero
  | `waitlist.${keyof typeof en.waitlist}`
  | `features.${keyof typeof en.features}.title`
  | `features.${keyof typeof en.features}.description`
  | 'features.learn_more';

const translations = {
  en,
  es,
} as const;

export const getTranslation = (key: TranslationKey, language: Language): string => {
  if (key.startsWith('features.')) {
    const [, feature, type] = key.split('.');
    const featureData = translations[language].features[feature as keyof typeof en.features];
    if (typeof featureData === 'string') {
      return featureData;
    }
    if (type) {
      return featureData[type as 'title' | 'description'];
    }
    return featureData.title;
  }
  
  if (key.startsWith('waitlist.')) {
    const [, waitlistKey] = key.split('.');
    return translations[language].waitlist[waitlistKey as keyof typeof en.waitlist];
  }
  
  if (Object.keys(translations[language].hero).includes(key as string)) {
    return translations[language].hero[key as keyof typeof en.hero];
  }
  
  const allTranslations = {
    ...translations[language].nav,
    ...translations[language].form,
    ...translations[language].message,
    ...translations[language].pricing,
    ...translations[language].about,
    ...translations[language].footer
  };
  return allTranslations[key as keyof typeof allTranslations] || key;
};

export { en, es }; 