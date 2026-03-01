'use client';

import { useState } from 'react';
import { authApi } from '@/lib/api';
import { User } from '@/types';

interface LoginPageProps {
  onLogin: (user: User) => void;
  onSwitchToRegister: () => void;
}

export default function LoginPage({ onLogin, onSwitchToRegister }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { token, user } = await authApi.login(username, password);
      localStorage.setItem('eclipay_token', token);
      onLogin(user);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">
              Welcome to EcliPay
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Sign in to your EcliPay account
            </p>
          </div>

          <div className="mt-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                  Username
                </label>
                <div className="mt-1">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-field block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-inset sm:text-sm"
                    placeholder="Enter your username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-inset sm:text-sm"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-900 p-4">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full flex justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-slate-900 text-gray-400">New to EcliPay?</span>
                </div>
              </div>
              
              <div className="mt-4">
                <button
                  onClick={onSwitchToRegister}
                  className="w-full text-center py-2 px-4 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:border-gray-500 hover:bg-gray-800 transition-colors"
                >
                  Create a new account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-20 xl:px-24 bg-slate-800">
        <div className="mx-auto max-w-xl">
          <div className="text-center">
            <div className="mx-auto h-20 w-20 rounded-full bg-primary-600 flex items-center justify-center">
              <span className="text-3xl">💳</span>
            </div>
            <h1 className="mt-6 text-4xl font-bold text-white">EcliPay</h1>
            <p className="mt-4 text-lg text-gray-300">
              Multi-chain USDT payment gateway for merchants
            </p>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-2xl mb-2">🔹</div>
              <p className="text-sm text-gray-400">Ethereum</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">🟢</div>
              <p className="text-sm text-gray-400">Solana</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-2">💎</div>
              <p className="text-sm text-gray-400">TON</p>
            </div>
          </div>

          <div className="mt-12">
            <h3 className="text-xl font-semibold text-white mb-4">Features</h3>
            <ul className="space-y-3">
              <li className="flex items-center text-gray-300">
                <div className="h-2 w-2 bg-primary-500 rounded-full mr-3"></div>
                Multi-chain USDT support
              </li>
              <li className="flex items-center text-gray-300">
                <div className="h-2 w-2 bg-primary-500 rounded-full mr-3"></div>
                Real-time transaction monitoring
              </li>
              <li className="flex items-center text-gray-300">
                <div className="h-2 w-2 bg-primary-500 rounded-full mr-3"></div>
                Automated invoice generation
              </li>
              <li className="flex items-center text-gray-300">
                <div className="h-2 w-2 bg-primary-500 rounded-full mr-3"></div>
                Webhook notifications
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}