import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/auth-context';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'SmartSchedule | Intelligent College Timetable System',
  description: 'Production-ready college timetable management and intelligent scheduling system.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </AuthProvider>
      </body>
    </html>
  );
}
