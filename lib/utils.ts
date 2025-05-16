import { redirect } from "next/navigation";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Redirects to a specified path with an encoded message as a query parameter.
 * @param {('error' | 'success')} type - The type of message, either 'error' or 'success'.
 * @param {string} path - The path to redirect to.
 * @param {string} message - The message to be encoded and added as a query parameter.
 * @returns {never} This function doesn't return as it triggers a redirect.
 */
export function encodedRedirect(
  type: "error" | "success",
  path: string,
  message: string,
) {
  const encodedMessage = encodeURIComponent(message);
  const redirectUrl = `${path}?${type}=${encodedMessage}`;
  console.log("Redirigiendo a:", redirectUrl);
  
  // Usar redirect directamente sin try/catch
  return redirect(redirectUrl);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
