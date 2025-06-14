import React from 'react';

type Crumb = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  crumbs: Crumb[];
  className?: string;
};

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ crumbs, className }) => (
  <nav className={`flex items-center text-sm ${className || ''}`} aria-label="Breadcrumb">
    <ol className="flex space-x-2">
      {crumbs.map((crumb, idx) => (
        <li key={idx} className="flex items-center">
          {crumb.href && idx !== crumbs.length - 1 ? (
            <a href={crumb.href} className="text-primary hover:underline focus:outline-none">
              {crumb.label}
            </a>
          ) : (
            <span className="text-gray-500">{crumb.label}</span>
          )}
          {idx < crumbs.length - 1 && <span className="mx-2 text-gray-400">/</span>}
        </li>
      ))}
    </ol>
  </nav>
);

export default Breadcrumbs; 