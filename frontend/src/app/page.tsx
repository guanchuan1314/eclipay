'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoginPage from '@/components/LoginPage';
import RegisterPage from '@/components/RegisterPage';
import Dashboard from '@/components/Dashboard';
import { authApi } from '@/lib/api';
import { User } from '@/types';

type AuthMode = 'login' | 'register';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('eclipay_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await authApi.getProfile();
        setUser(profile);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        // Clear invalid tokens
        localStorage.removeItem('eclipay_token');
        localStorage.removeItem('eclipay_selected_project');
        // Make sure to show login page
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (user: User) => {
    setUser(user);
    setIsAuthenticated(true);
  };

  const handleRegister = (user: User) => {
    setUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    authApi.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authMode === 'register') {
      return (
        <RegisterPage
          onRegister={handleRegister}
          onSwitchToLogin={() => setAuthMode('login')}
        />
      );
    }
    
    return (
      <LoginPage
        onLogin={handleLogin}
        onSwitchToRegister={() => setAuthMode('register')}
      />
    );
  }

  return <Dashboard user={user!} onLogout={handleLogout} />;
}