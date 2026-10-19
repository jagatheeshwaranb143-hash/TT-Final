'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function DashboardRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    const roleRoutes: Record<string, string> = {
      super_admin: '/principal',
      hod: '/hod',
      faculty: '/faculty',
      student: '/student',
    };
    router.replace(roleRoutes[user.role] || '/principal');
  }, [user, isLoading, router]);

  return (
    <div className="app-loading" role="status" aria-live="polite" aria-atomic="true">
      <LoaderCircle className="session-spinner" size={28} aria-hidden="true" />
      <div className="loading-copy">
        <strong>Redirecting to your dashboard</strong>
        <span>Checking your role and permissions&hellip;</span>
      </div>
    </div>
  );
}
