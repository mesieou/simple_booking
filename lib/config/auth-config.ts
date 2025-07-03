/**
 * Centralized authentication configuration
 * Handles site URLs and redirect paths for different environments
 */

export const getSiteUrl = (): string => {
  // First check for explicit environment variable
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // Fallback based on environment
  if (process.env.NODE_ENV === 'production') {
    return 'https://skedy.io';
  }
  
  // Development fallback
  return 'http://localhost:3000';
};

export const getAuthRedirectUrl = (path: string = '/auth/callback'): string => {
  const siteUrl = getSiteUrl();
  return `${siteUrl}${path}`;
};

export const getPasswordResetUrl = (): string => {
  return getAuthRedirectUrl('/protected/reset-password');
};

export const getSignUpRedirectUrl = (returnUrl?: string): string => {
  const baseUrl = getAuthRedirectUrl('/auth/callback');
  
  if (returnUrl) {
    return `${baseUrl}?returnUrl=${encodeURIComponent(returnUrl)}`;
  }
  
  return baseUrl;
}; 