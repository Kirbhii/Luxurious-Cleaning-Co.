import type { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  width?: 'narrow' | 'standard' | 'wide';
  className?: string;
}

/**
 * PageContainer - Standardized container for consistent page layouts
 * Prevents element shifting when navigating between pages
 * 
 * Widths:
 * - narrow: max-w-3xl (for forms, focused content)
 * - standard: max-w-5xl (for text-heavy pages)
 * - wide: max-w-7xl (for services, galleries, default)
 */
export default function PageContainer({ children, width = 'wide', className = '' }: PageContainerProps) {
  const widthClass = {
    narrow: 'max-w-3xl',
    standard: 'max-w-5xl',
    wide: 'max-w-7xl',
  }[width];

  return (
    <div className={`${widthClass} mx-auto px-6 ${className}`}>
      {children}
    </div>
  );
}
