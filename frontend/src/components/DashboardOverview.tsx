'use client';

import { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, Activity, Eye, EyeOff } from 'lucide-react';
import { dashboardApi, chainsApi } from '@/lib/api';
import { DashboardStats, Transaction, Chain } from '@/types';
import { formatCurrency, formatDate, getChainIcon, getStatusBadgeClass } from '@/lib/utils';

interface DashboardOverviewProps {
  projectId: string;
  environment?: string;
}

export default function DashboardOverview({ projectId, environment }: DashboardOverviewProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBalances, setShowBalances] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, transactionsData, chainsData] = await Promise.all([
          dashboardApi.getStats(projectId),
          dashboardApi.getRecentTransactions(projectId, 5),
          chainsApi.getAll(environment === 'mainnet' ? false : true),
        ]);
        
        setStats(statsData);
        setRecentTransactions(transactionsData);
        setChains(chainsData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-slate-600 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-slate-600 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Deposits',
      value: stats?.totalDeposits || '0',
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-900/20',
    },
    {
      title: 'Total Withdrawals',
      value: stats?.totalWithdrawals || '0',
      icon: TrendingDown,
      color: 'text-red-400',
      bgColor: 'bg-red-900/20',
    },
    {
      title: 'Active Wallets',
      value: stats?.activeWallets?.toString() || '0',
      icon: Wallet,
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/20',
      isCount: true,
    },
    {
      title: 'Pending Transactions',
      value: stats?.pendingTransactions?.toString() || '0',
      icon: Activity,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-900/20',
      isCount: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-white">
                    {stat.isCount 
                      ? stat.value 
                      : formatCurrency(stat.value)
                    }
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Balance by Chain */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Balance by Chain</h3>
          <button
            onClick={() => setShowBalances(!showBalances)}
            className="flex items-center text-sm text-gray-400 hover:text-white"
          >
            {showBalances ? (
              <EyeOff className="h-4 w-4 mr-1" />
            ) : (
              <Eye className="h-4 w-4 mr-1" />
            )}
            {showBalances ? 'Hide' : 'Show'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chains.map((chain) => {
            const rawBalance = stats?.balanceByChain?.[chain.id.toString()] || stats?.balanceByChain?.[chain.id] || '0';
            const balance = typeof rawBalance === 'object' && rawBalance !== null ? (rawBalance as any).balance || '0' : String(rawBalance);
            return (
              <div key={chain.id} className="bg-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{getChainIcon(chain.id.toString())}</span>
                    <div>
                      <p className="font-medium text-white">{chain.name}</p>
                      <p className="text-xs text-gray-400">{chain.standard}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">
                      {showBalances ? formatCurrency(balance) : '•••••'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
          <a href="#" className="text-primary-400 hover:text-primary-300 text-sm font-medium">
            View all
          </a>
        </div>
        
        {recentTransactions.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentTransactions.map((transaction) => {
              const chain = chains.find(c => c.id === transaction.chainId);
              return (
                <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-10 h-10 bg-slate-600 rounded-lg mr-3">
                      <span className="text-lg">{getChainIcon(transaction.chainId.toString())}</span>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-white">
                          {transaction.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                        </p>
                        <span className={getStatusBadgeClass(transaction.status)}>
                          {transaction.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {formatDate(transaction.createdAt)} • {chain?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      transaction.type === 'deposit' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {transaction.type === 'deposit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </p>
                    <p className="text-sm text-gray-400">
                      {transaction.txHash.slice(0, 8)}...
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}