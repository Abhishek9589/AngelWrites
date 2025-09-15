import React, { createContext, useContext, useMemo, useState } from "react";
import { getAppName as getStoredAppName, setAppName as setStoredAppName } from "@/lib/appMeta";

interface AppNameContextValue {
  name: string;
  setName: (name: string) => void;
}

const AppNameContext = createContext<AppNameContextValue | undefined>(undefined);

export function AppNameProvider({ children }: { children: React.ReactNode }) {
  const [name, setNameState] = useState<string>(() => getStoredAppName());

  const setName = (next: string) => {
    setStoredAppName(next);
    setNameState(getStoredAppName());
  };

  const value = useMemo(() => ({ name, setName }), [name]);
  return <AppNameContext.Provider value={value}>{children}</AppNameContext.Provider>;
}

export function useAppName() {
  const ctx = useContext(AppNameContext);
  if (!ctx) throw new Error("useAppName must be used within AppNameProvider");
  return ctx;
}
