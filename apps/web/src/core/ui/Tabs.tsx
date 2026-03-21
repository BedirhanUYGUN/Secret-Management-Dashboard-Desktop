import { type ReactNode, createContext, useContext } from "react";
import { cn } from "./cn";

type TabsContextValue = { value: string; onChange: (value: string) => void };
const TabsContext = createContext<TabsContextValue>({ value: "", onChange: () => {} });

function Tabs({ value, onValueChange, children, className }: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsContext value={{ value, onChange: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext>
  );
}

function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-[var(--muted)] p-1 text-[var(--muted-foreground)]",
        className,
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

function TabsTrigger({ value, children, className }: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  const isActive = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-[var(--background)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        isActive && "bg-[var(--background)] text-[var(--foreground)] shadow",
        className,
      )}
      onClick={() => ctx.onChange(value)}
    >
      {children}
    </button>
  );
}

function TabsContent({ value, children, className }: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsContext);
  if (ctx.value !== value) return null;
  return (
    <div
      role="tabpanel"
      className={cn("mt-2 ring-offset-[var(--background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2", className)}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
