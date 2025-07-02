"use client";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

interface PageWithBreadcrumbProps {
  children: React.ReactNode;
  className?: string;
  showBreadcrumb?: boolean;
  breadcrumbClassName?: string;
}

export const PageWithBreadcrumb = ({ 
  children, 
  className = "",
  showBreadcrumb = true,
  breadcrumbClassName = ""
}: PageWithBreadcrumbProps) => {
  return (
    <div className={cn("min-h-screen", className)}>
      {showBreadcrumb && (
        <div className="bg-background border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Breadcrumb className={breadcrumbClassName} />
          </div>
        </div>
      )}
      {children}
    </div>
  );
}; 