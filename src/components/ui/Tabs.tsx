import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export const Tabs = ({ value, onValueChange, children, className }: TabsProps) => {
  return (
    <div className={cn('w-full', className)} data-state={value}>
      {children}
    </div>
  );
};

export const TabsList = ({ children, className }: TabsListProps) => {
  return (
    <div
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500',
        className
      )}
    >
      {children}
    </div>
  );
};

export const TabsTrigger = ({ value, children, className }: TabsTriggerProps) => {
  return (
    <button
      role="tab"
      data-state={value}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=true]:bg-white data-[state=true]:text-gray-950 data-[state=true]:shadow-sm',
        className
      )}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, className }: TabsContentProps) => {
  return (
    <div
      role="tabpanel"
      data-state={value}
      className={cn(
        'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2',
        className
      )}
    >
      {children}
    </div>
  );
}; 