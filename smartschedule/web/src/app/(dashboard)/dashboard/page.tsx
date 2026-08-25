'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚡</div>
        <p style={{ color: '#64748b' }}>Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}
