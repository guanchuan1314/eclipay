'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Copy, ExternalLink, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { walletsApi, chainsApi, projectsApi } from '@/lib/api';
import { Wallet, Chain, Project } from '@/types';
import { formatCurrency, formatDate, formatAddress, getChainIcon, getStatusColor } from '@/lib/utils';

interface WalletsPageProps {
  projectId: string;
}

export default function WalletsPage({ projectId }: WalletsPageProps) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [masterWallets, setMasterWallets] = useState<any[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState('');
  const [balances, setBalances] = useState<Record<number, { balance: string; loading: boolean }>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState('');
  const [filterChainId, setFilterChainId] = useState('');
  const [filterAddress, setFilterAddress] = useState('');
  
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      // First get the project to determine environment
      const projectData = await projectsApi.getById(projectId);
      setProject(projectData);

      const isTestnet = projectData.environment === 'testnet';
      
      const [walletsData, chainsData, masterWalletsData] = await Promise.all([
        walletsApi.getAll(projectId),
        chainsApi.getAll(isTestnet),
        fetch(`/api/projects/${projectId}/master-wallets`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('eclipay_token')}`,
          },
        }).then(res => res.ok ? res.json() : []).catch(() => [])
      ]);
      
      setWallets(walletsData);
      setChains(chainsData);
      setMasterWallets(masterWalletsData);
    } catch (error) {
      console.error('Failed to fetch wallets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Lazy load balance for a single master wallet
  const fetchBalance = async (walletId: number) => {
    setBalances(prev => ({ ...prev, [walletId]: { balance: prev[walletId]?.balance || '...', loading: true } }));
    try {
      const res = await fetch(`/api/projects/${projectId}/master-wallets/${walletId}/balance`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('eclipay_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBalances(prev => ({ ...prev, [walletId]: { balance: data.nativeBalance || '0', loading: false } }));
      } else {
        setBalances(prev => ({ ...prev, [walletId]: { balance: '?', loading: false } }));
      }
    } catch {
      setBalances(prev => ({ ...prev, [walletId]: { balance: '?', loading: false } }));
    }
  };

  // Auto-fetch balances one by one after master wallets load
  useEffect(() => {
    if (masterWallets.length > 0) {
      masterWallets.forEach((mw, i) => {
        setTimeout(() => fetchBalance(mw.id), i * 500); // stagger by 500ms
      });
    }
  }, [masterWallets]);

  const refreshAllBalances = () => {
    masterWallets.forEach((mw, i) => {
      setTimeout(() => fetchBalance(mw.id), i * 500);
    });
  };

  const handleCreateWallet = async () => {
    if (!selectedChainId) return;
    
    setIsCreating(true);
    try {
      const newWallet = await walletsApi.create(projectId, selectedChainId);
      // Attach chain info if not included in response
      if (!newWallet.chain) {
        newWallet.chain = chains.find(c => String(c.id) === String(newWallet.chainId));
      }
      setWallets([newWallet, ...wallets]);
      setShowCreateModal(false);
      setSelectedChainId('');
      // TODO: Show success feedback to user
    } catch (error) {
      console.error('Failed to create wallet:', error);
      // TODO: Show error feedback to user
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(id);
      setTimeout(() => setCopiedAddress(''), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getFaucetLink = (chainName: string) => {
    const faucets: Record<string, { url: string; text: string }> = {
      'Ethereum Sepolia': { url: 'https://sepoliafaucet.com', text: 'Get Sepolia ETH' },
      'BSC Testnet': { url: 'https://testnet.bnbchain.org/faucet-smart', text: 'Get Test BNB' },
      'Polygon Amoy': { url: 'https://faucet.polygon.technology', text: 'Get Test MATIC' },
      'Tron Nile': { url: 'https://nileex.io/join/getJoinPage', text: 'Get Test TRX' },
      'Solana Devnet': { url: '/faucet', text: 'Get Test SOL' },
    };
    
    return faucets[chainName];
  };

  const getApprovalStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-400" />;
      case 'pending':
      default:
        return <Clock className="h-5 w-5 text-yellow-400" />;
    }
  };

  const navigateToMasterWallet = (walletId: number) => {
    router.push(`/wallet/master/${walletId}?projectId=${projectId}`);
  };

  const navigateToSubWallet = (walletId: number) => {
    router.push(`/wallet/sub/${walletId}?projectId=${projectId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Wallets</h1>
          <div className="h-10 w-32 bg-slate-600 rounded animate-pulse"></div>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-slate-600 rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-slate-600 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Wallets</h1>
          <p className="text-gray-400 mt-1">Manage your payment receiving wallets</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Wallet
        </button>
      </div>

      {/* Master Wallets Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Master Wallets</h2>
          <button
            onClick={refreshAllBalances}
            className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh Balances
          </button>
        </div>
        
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span className="text-sm font-medium text-blue-300">Important</span>
          </div>
          <p className="text-sm text-gray-300">
            Fund these wallets with gas tokens to enable payment collection. Master wallets collect all payments from sub-wallets on each blockchain.
          </p>
        </div>

        {masterWallets.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {masterWallets.map((masterWallet) => (
              <div 
                key={masterWallet.id} 
                className="card p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => navigateToMasterWallet(masterWallet.id)}
              >
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-slate-600 rounded-lg mr-3">
                    <span className="text-lg">{getChainIcon(masterWallet.chainId.toString())}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{masterWallet.chainName}</h3>
                    <span className="text-xs text-gray-400">Master Wallet</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Address
                    </label>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-gray-300 font-mono">
                        {formatAddress(masterWallet.address, 10)}
                      </code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(masterWallet.address, `master-${masterWallet.id}`);
                        }}
                        className="p-1 text-gray-400 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded transition-colors"
                        title="Copy address"
                      >
                        {copiedAddress === `master-${masterWallet.id}` ? (
                          <CheckCircle className="h-3 w-3 text-green-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Gas Balance
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchBalance(masterWallet.id);
                        }}
                        className="ml-1 text-gray-500 hover:text-white transition-colors"
                        title="Refresh balance"
                      >
                        <RefreshCw className={`h-3 w-3 ${balances[masterWallet.id]?.loading ? 'animate-spin' : ''}`} />
                      </button>
                    </label>
                    <p className="text-sm text-gray-300">
{balances[masterWallet.id]?.loading ? '...' : parseFloat(balances[masterWallet.id]?.balance || '0').toFixed(4)} {masterWallet.gasToken || 'TOKEN'}
                    </p>
                  </div>

                  {/* Testnet Faucet Links */}
                  {project?.environment === 'testnet' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Get Test Tokens
                      </label>
                      {(() => {
                        const faucet = getFaucetLink(masterWallet.chainName);
                        if (faucet) {
                          if (faucet.url) {
                            return (
                              <a
                                href={faucet.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                              >
                                <span>{faucet.text}</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            );
                          } else {
                            return (
                              <p className="text-xs text-gray-400 font-mono">
                                {faucet.text}
                              </p>
                            );
                          }
                        }
                        return (
                          <p className="text-xs text-gray-500">
                            No faucet available
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center">
            <div className="mx-auto w-12 h-12 bg-slate-600 rounded-lg flex items-center justify-center mb-4">
              <span className="text-xl">⚡</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Master wallets generating...</h3>
            <p className="text-gray-400">Master wallets are being created for all supported chains</p>
          </div>
        )}
      </div>

      {/* Sub Wallets Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Sub Wallets</h2>
          <span className="text-sm text-gray-400">
            Individual payment addresses
          </span>
        </div>

        {/* Filters */}
        {wallets.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={filterChainId}
              onChange={(e) => setFilterChainId(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-48"
            >
              <option value="">All Chains</option>
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id.toString()}>
                  {chain.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={filterAddress}
              onChange={(e) => setFilterAddress(e.target.value)}
              placeholder="Search by address..."
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            />
          </div>
        )}

        {/* Sub Wallets Grid */}
        {wallets.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-slate-600 rounded-lg flex items-center justify-center mb-4">
            <span className="text-xl">💼</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No wallets yet</h3>
          <p className="text-gray-400 mb-6">Create your first wallet to start receiving payments</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Your First Wallet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {wallets.filter((w) => {
            if (filterChainId && String(w.chainId) !== filterChainId) return false;
            if (filterAddress && !w.address.toLowerCase().includes(filterAddress.toLowerCase())) return false;
            return true;
          }).map((wallet) => {
            // Use wallet.chain if available, otherwise fall back to lookup
            const chain = wallet.chain || chains.find(c => c.id === wallet.chainId);
            const approvalStatus = wallet.approved ? 'approved' : 'pending';
            
            return (
              <div 
                key={wallet.id} 
                className="card p-6 cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => navigateToSubWallet(wallet.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-slate-600 rounded-lg mr-4">
                      <span className="text-xl">{getChainIcon(wallet.chainId.toString())}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{chain?.name || `Chain ${wallet.chainId}`}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        {getApprovalStatusIcon(approvalStatus)}
                        <span className={`text-sm capitalize ${getStatusColor(approvalStatus)}`}>
                          {approvalStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
                      Created
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Address
                    </label>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-gray-300 font-mono">
                        {formatAddress(wallet.address, 12)}
                      </code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(wallet.address, wallet.id.toString());
                        }}
                        className="p-2 text-gray-400 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded transition-colors"
                        title="Copy address"
                      >
                        {copiedAddress === wallet.id.toString() ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Chain
                      </label>
                      <p className="text-sm text-gray-300">
                        {chain?.name || `Chain ${wallet.chainId}`}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Created
                      </label>
                      <p className="text-sm text-gray-300">
                        {formatDate(wallet.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Create Wallet Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setShowCreateModal(false)}></div>
            <div className="relative bg-slate-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">Create New Wallet</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Select Chain
                </label>
                <select
                  value={selectedChainId}
                  onChange={(e) => setSelectedChainId(e.target.value)}
                  className="input-field w-full rounded-md"
                >
                  <option value="">Choose a blockchain...</option>
                  {chains.map((chain) => (
                    <option key={chain.id} value={chain.id.toString()}>
                      {getChainIcon(chain.id.toString())} {chain.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWallet}
                  disabled={!selectedChainId || isCreating}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : null}
                  {isCreating ? 'Creating...' : 'Create Wallet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}