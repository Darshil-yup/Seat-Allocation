"use client";

import Image from 'next/image';
import { ThemeSwitcher } from '@/components/theme-switcher';

const AppHeader = () => {
  return (
    <header className="bg-card border-b">
      <div className="container mx-auto p-4 md:p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <Image
            src="/logo-modified.jpg"
            alt="YCCE Logo"
            width={64}
            height={64}
            className="rounded-lg"
          />
        </div>
          <div>
            <h1 className="text-3xl font-bold text-primary-dark font-headline">YCCE-SeatAssign</h1>
            <p className="text-muted-foreground">
              Intelligent Seating Arrangement Generator
            </p>
          </div>
        </div>
        <ThemeSwitcher />
      </div>
    </header>
  );
};

export default AppHeader;
