export const translations = {
  nav: {
    home: 'Home',
    about: 'About',
    services: 'Services',
    booking: 'Booking'
  },
  form: {
    submit: 'Submit',
    cancel: 'Cancel'
  },
  message: {
    loading: 'Loading...',
    error: 'An error occurred'
  },
  pricing: {
    base: 'Base fare',
    miles: 'Traveled miles',
    labor: 'Labor fee',
    total: 'Total price'
  },
  about: {
    description: 'Is a modern platform for booking and calendar management, designed for service businesses that want to optimize their operations and improve the customer experience.',
    feature_booking: 'Real-time booking and quote management',
    feature_schedule: 'Control of schedules and availability',
    feature_chatbot: 'Intelligent chatbot for automated support',
    feature_roles: 'Support for multiple roles and businesses',
    feature_interface: 'Intuitive interface adaptable to any device',
    mission: 'Our mission is to make business digitalization easy, allowing both customers and providers to manage their services efficiently, securely, and simply.'
  },
  footer: {
    resources: 'Resources',
    support: 'Support',
    legal: 'Legal',
    features: 'Features',
    prices: 'Prices',
    contact: 'Contact',
    questions: 'Frequently Asked Questions',
    rights: 'All rights reserved',
    terms: 'Terms & Conditions',
    privacy: 'Privacy Policy',
    cookies: 'Cookie Policy'
  },
  features: {
    whatsapp_ia: {
      title: 'WhatsApp AI Agent',
      description: 'Our AI agent integrated with WhatsApp automates responses, manages queries, and improves customer experience 24/7.'
    },
    dynamic_pricing: {
      title: 'Dynamic Pricing',
      description: 'Intelligent pricing system that automatically adjusts based on demand, season, and other market factors.'
    },
    calendar: {
      title: 'Calendar Management',
      description: 'Efficient calendar management with real-time synchronization, automatic reminders, and online availability.'
    },
    team: {
      title: 'Multi-user and Team Management',
      description: 'Collaborative platform that allows managing multiple users, assigning roles, and monitoring team performance.'
    },
    learn_more: 'Learn more'
  },
  hero: {
    title: 'We help mobile business to manage their',
    bookings: 'bookings',
    and: 'and',
    calendars: 'calendars',
    with_ai: 'with Ai agents'
  },
  waitlist: {
    title: 'Join the Waitlist',
    email_placeholder: 'Enter your email',
    submit: 'Join Waitlist',
    success: 'Thank you for joining the waitlist!',
    error_invalid_email: 'Please enter a valid email address.',
    error_generic: 'Oops! Something went wrong. Please try again.'
  }
} as const;

export type TranslationKey = 
  | keyof typeof translations.nav 
  | keyof typeof translations.form 
  | keyof typeof translations.message 
  | keyof typeof translations.pricing
  | keyof typeof translations.about
  | keyof typeof translations.footer
  | keyof typeof translations.hero
  | `waitlist.${keyof typeof translations.waitlist}`
  | `features.${keyof typeof translations.features}.title`
  | `features.${keyof typeof translations.features}.description`
  | 'features.learn_more';

export const t = (key: TranslationKey): string => {
  if (key.startsWith('features.')) {
    const [, feature, type] = key.split('.');
    const featureData = translations.features[feature as keyof typeof translations.features];
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
    return translations.waitlist[waitlistKey as keyof typeof translations.waitlist];
  }
  
  if (Object.keys(translations.hero).includes(key as string)) {
    return translations.hero[key as keyof typeof translations.hero];
  }
  
  const allTranslations = {
    ...translations.nav,
    ...translations.form,
    ...translations.message,
    ...translations.pricing,
    ...translations.about,
    ...translations.footer
  };
  return allTranslations[key as keyof typeof allTranslations] || key;
}; 