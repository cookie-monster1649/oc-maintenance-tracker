'use client';

import { GodModeProvider } from './contexts/god-mode';

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GodModeProvider>{children}</GodModeProvider>;
}
