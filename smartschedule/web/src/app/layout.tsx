import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/auth-context';
import ThemeRuntime from '@/components/ThemeRuntime';
import '@/styles/globals.css';
import '@/styles/theme.css';

export const metadata: Metadata = {
  title: 'SEC SchedX | Intelligent College Timetable System',
  description: 'Production-ready college timetable management and intelligent scheduling system.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=JSON.parse(localStorage.getItem('smartschedule.basicPreferences')||'{}');var t=p.theme||'light';var r=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r}catch(e){document.documentElement.dataset.theme='light';document.documentElement.style.colorScheme='light'}})()` }} />
        <AuthProvider>
          <ThemeRuntime />
          {children}
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </AuthProvider>
      </body>
    </html>
  );
}
