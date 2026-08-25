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
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then(async response => {
        if (!response.ok) throw new Error('Stored session is no longer valid');
        const currentUser = await response.json();
        setToken(savedToken);
        setUser(currentUser);
        localStorage.setItem('smartschedule_user', JSON.stringify(currentUser));
      })
      .catch(() => {
        localStorage.removeItem('smartschedule_token');
        localStorage.removeItem('smartschedule_user');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
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
