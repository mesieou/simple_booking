"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function FormError() {
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      setError(decodeURIComponent(error));
    }
  }, [searchParams]);

  if (!error) return null;

  return (
    <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
      {error}
    </div>
  );
} 