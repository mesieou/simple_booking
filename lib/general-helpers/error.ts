export class ModelError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = "ModelError";
  }
}

export function handleModelError(message: string, error: any): never {
  const errorDetails = error ? {
    message: error.message,
    details: error.details,
    code: error.code,
    hint: error.hint
  } : {};
  console.error(message, errorDetails);
  throw new ModelError(message, error);
} 