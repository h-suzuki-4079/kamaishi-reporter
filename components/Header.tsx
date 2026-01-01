'use client';

import Link from 'next/link';
import { useAdminMode } from '@/contexts/AdminModeContext';

export default function Header() {
  const { isAdminMode, setIsAdminMode } = useAdminMode();

  return (
    <header className="bg-navy-900 text-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Reporter&apos;s Note
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsAdminMode(!isAdminMode)}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
            >
              {isAdminMode ? '管理者モード' : 'ワーカーモード'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

