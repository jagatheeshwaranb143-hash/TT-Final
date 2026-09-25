'use client';
import { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'hod' | 'faculty' | 'student';
  college_id: string | null;
  department_id: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('smartschedule_token');
    if (!savedToken) {
      setIsLoading(false);
      return;
    }
    const savedUser = localStorage.getItem('smartschedule_user');
    if (savedUser) {
      try {
        const cachedUser = JSON.parse(savedUser) as User;
        if (cachedUser?.id && cachedUser?.role && cachedUser?.full_name) {
          setToken(savedToken);
          setUser(cachedUser);
          setIsLoading(false);
        }
      } catch {
        localStorage.removeItem('smartschedule_user');
      }
    }
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    let active = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4000);
    fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${savedToken}` },
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error('Stored session is no longer valid');
        const currentUser = await response.json();
        if (!active) return;
        setToken(savedToken);
        setUser(currentUser);
        localStorage.setItem('smartschedule_user', JSON.stringify(currentUser));
      })
      .catch(() => {
        if (!active) return;
        setToken(null);
        setUser(null);
        localStorage.removeItem('smartschedule_token');
        localStorage.removeItem('smartschedule_user');
        window.location.replace('/login');
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch (networkErr) {
      throw new Error('Cannot reach server. Make sure the backend is running on port 8000.');
    }
    if (!response.ok) {
      let errorMsg = 'Login failed';
      try {
        const errBody = await response.json();
        // FastAPI returns { detail: '...' }, some endpoints return { message: '...' }
        errorMsg = errBody.detail || errBody.message || `Error ${response.status}`;
      } catch {}
      throw new Error(errorMsg);
    }
    const data = await response.json();
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('smartschedule_token', data.access_token);
    localStorage.setItem('smartschedule_user', JSON.stringify(data.user));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('smartschedule_token');
    localStorage.removeItem('smartschedule_user');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
