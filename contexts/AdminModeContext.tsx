'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface AdminModeContextType {
  isAdminMode: boolean;
  setIsAdminMode: (value: boolean) => void;
}

const AdminModeContext = createContext<AdminModeContextType | undefined>(undefined);

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const [isAdminMode, setIsAdminMode] = useState(false);

  return (
    <AdminModeContext.Provider value={{ isAdminMode, setIsAdminMode }}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  const context = useContext(AdminModeContext);
  if (context === undefined) {
    throw new Error('useAdminMode must be used within an AdminModeProvider');
  }
  return context;
}


