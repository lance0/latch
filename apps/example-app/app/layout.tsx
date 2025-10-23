import type { Metadata } from 'next';
import './globals.css';
import { LatchProvider } from '@lance0/latch/react';

export const metadata: Metadata = {
  title: 'Latch - Modern OIDC for Next.js',
  description: 'Secure authentication for Azure Government clouds',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LatchProvider>{children}</LatchProvider>
      </body>
    </html>
  );
}
