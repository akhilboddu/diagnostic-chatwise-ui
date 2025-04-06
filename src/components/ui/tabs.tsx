import * as React from "react";
import { cn } from "./lib/utils";

// Create context
interface TabsContextValue {
  value: string;
  onValueChange?: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, className, children }) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("", className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

interface TabsListProps {
  className?: string;
  children?: React.ReactNode;
}

export const TabsList: React.FC<TabsListProps> = ({ className, children }) => {
  return (
    <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500 dark:bg-gray-800 dark:text-gray-400", className)}>
      {children}
    </div>
  );
};

interface TabsTriggerProps {
  value: string;
  children?: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, children, className, onClick, ...props }) => {
  const context = React.useContext(TabsContext);
  
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    context?.onValueChange?.(value);
    onClick?.(event);
  };

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-gray-950 dark:focus-visible:ring-gray-800",
        context?.value === value && "bg-white text-gray-950 shadow-sm dark:bg-gray-950 dark:text-gray-50",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};

interface TabsContentProps {
  value: string;
  children?: React.ReactNode;
  className?: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, children, className }) => {
  const context = React.useContext(TabsContext);
  
  if (context?.value !== value) {
    return null;
  }

  return (
    <div className={cn("mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:ring-offset-gray-950 dark:focus-visible:ring-gray-800", className)}>
      {children}
    </div>
  );
};

// Set display names
Tabs.displayName = "Tabs";
TabsList.displayName = "TabsList";
TabsTrigger.displayName = "TabsTrigger";
TabsContent.displayName = "TabsContent"; 