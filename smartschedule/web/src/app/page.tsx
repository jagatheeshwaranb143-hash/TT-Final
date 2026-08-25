'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    const roleRoutes: Record<string, string> = {
      super_admin: '/principal',
      hod: '/hod',
      faculty: '/faculty',
      student: '/student',
    };
    router.replace(roleRoutes[user.role] || '/login');
  }, [user, isLoading, router]);
  
  return <div className="loading-screen">Loading SmartSchedule...</div>;
}
