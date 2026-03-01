'use client';

import { useState, useEffect } from 'react';
import { Filter, Download, ExternalLink, Search } from 'lucide-react';
import { transactionsApi, chainsApi } from '@/lib/api';
import { Transaction, Chain } from '@/types';
import { 
  formatCurrency, 
  formatDate, 
  formatAddress, 
  getChainIcon, 
  getStatusBadgeClass 
} from '@/lib/utils';

interface TransactionFilters {
  chainId?: string;
  status?: string;
  type?: string;
  fromDate?: string;
  toDate?: string;
}

interface TransactionsPageProps {
  projectId: string;
}

export default function TransactionsPage({ projectId }: TransactionsPageProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });

  useEffect(() => {
    fetchChains();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [filters, pagination.page, projectId]);

  const fetchChains = async () => {
    try {
      const chainsData = await chainsApi.getAll();
      setChains(chainsData);
    } catch (error) {
      console.error('Failed to fetch chains:', error);
    }
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const response = await transactionsApi.getAll(projectId, {
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      });
      
      setTransactions(response);
      setPagination(prev => ({
        ...prev,
        total: response.length,
      }));
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: keyof TransactionFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const filteredTransactions = transactions.filter(transaction => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      (transaction.txHash || '').toLowerCase().includes(searchLower) ||
      (transaction.fromAddress || '').toLowerCase().includes(searchLower) ||
      (transaction.toAddress || '').toLowerCase().includes(searchLower) ||
      transaction.amount.includes(searchTerm)
    );
  });

  const hasActiveFilters = Object.values(filters).some(Boolean) || searchTerm;

  if (isLoading && transactions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
        </div>
        <div className="card p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-600 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-gray-400 mt-1">
            {pagination.total} total transactions
            {hasActiveFilters && ` (${filteredTransactions.length} filtered)`}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center ${
              hasActiveFilters ? 'bg-primary-600 text-white' : ''
            }`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 bg-white bg-opacity-20 text-xs px-2 py-1 rounded-full">
                {Object.values(filters).filter(Boolean).length + (searchTerm ? 1 : 0)}
              </span>
            )}
          </button>
          <button className="btn-secondary flex items-center">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Chain
              </label>
              <select
                value={filters.chainId || ''}
                onChange={(e) => handleFilterChange('chainId', e.target.value)}
                className="input-field w-full rounded-md"
              >
                <option value="">All chains</option>
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id.toString()}>
                    {getChainIcon(chain.id.toString())} {chain.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input-field w-full rounded-md"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Type
              </label>
              <select
                value={filters.type || ''}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="input-field w-full rounded-md"
              >
                <option value="">All types</option>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={filters.fromDate || ''}
                onChange={(e) => handleFilterChange('fromDate', e.target.value)}
                className="input-field w-full rounded-md"
              />
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by hash, address, or amount..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field w-full pl-10 rounded-md"
              />
            </div>
            
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-400 hover:text-white ml-4"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="card overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-12 h-12 bg-slate-600 rounded-lg flex items-center justify-center mb-4">
              <span className="text-xl">📋</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {hasActiveFilters ? 'No matching transactions' : 'No transactions yet'}
            </h3>
            <p className="text-gray-400">
              {hasActiveFilters 
                ? 'Try adjusting your filters or search terms' 
                : 'Transactions will appear here once you start receiving payments'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type & Chain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-slate-800 divide-y divide-slate-700">
                {filteredTransactions.map((transaction) => {
                  const chain = chains.find(c => c.id === transaction.chainId);
                  return (
                    <tr key={transaction.id} className="hover:bg-slate-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-mono text-sm text-white">
                            {formatAddress(transaction.txHash, 8)}
                          </div>
                          <div className="text-sm text-gray-400">
                            From: {formatAddress(transaction.fromAddress, 6)}
                          </div>
                          <div className="text-sm text-gray-400">
                            To: {formatAddress(transaction.toAddress, 6)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">{getChainIcon(transaction.chainId.toString())}</span>
                          <div>
                            <div className={`font-medium capitalize ${
                              transaction.type === 'deposit' ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {transaction.type}
                            </div>
                            <div className="text-sm text-gray-400">
                              {chain?.name || `Chain ${transaction.chainId}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`font-semibold ${
                          transaction.type === 'deposit' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {transaction.type === 'deposit' ? '+' : '-'}{parseFloat(transaction.amount).toFixed(6)} {(transaction as any).token || 'USDT'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusBadgeClass(transaction.status)}>
                          {transaction.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <div>{formatDate(transaction.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <span className="text-gray-400 text-sm">
                          View in Explorer
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex items-center justify-between bg-slate-800 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <p className="text-sm text-gray-400">
              Showing{' '}
              <span className="font-medium text-white">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium text-white">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of{' '}
              <span className="font-medium text-white">{pagination.total}</span>{' '}
              results
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page * pagination.limit >= pagination.total}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}