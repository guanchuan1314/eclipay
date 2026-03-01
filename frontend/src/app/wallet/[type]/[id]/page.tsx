'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Copy, RefreshCw, ExternalLink, CheckCircle, XCircle, DollarSign, Send } from 'lucide-react';
import { formatAddress, formatDate, getChainIcon } from '@/lib/utils';

interface Asset {
  token: string;
  type: 'native' | 'usdt';
  balance: string;
  decimals: number;
}

interface WalletDetail {
  id: number;
  address: string;
  chainId: number;
  chainName: string;
  type: string;
  approved: boolean;
  createdAt: string;
}

interface WalletAssets {
  wallet: WalletDetail;
  assets: Asset[];
}

interface SendResult {
  success: boolean;
  txHash: string;
  explorer: string;
}

export default function WalletDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const walletType = params.type as 'master' | 'sub';
  const walletId = params.id as string;
  const projectId = searchParams.get('projectId');

  const [walletAssets, setWalletAssets] = useState<WalletAssets | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  
  // Send form state
  const [showSendForm, setShowSendForm] = useState(false);
  const [selectedToken, setSelectedToken] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [sendError, setSendError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!projectId) {
      router.push('/dashboard');
      return;
    }
    fetchWalletAssets();
    fetchTransactions();
  }, [walletType, walletId, projectId]);

  const fetchWalletAssets = async () => {
    try {
      setIsRefreshing(true);
      let url: string;
      
      if (walletType === 'master') {
        url = `/api/projects/${projectId}/master-wallets/${walletId}/assets`;
      } else {
        url = `/api/projects/${projectId}/wallets/${walletId}/assets`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('eclipay_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wallet assets');
      }

      const data = await response.json();
      setWalletAssets(data);
    } catch (error) {
      console.error('Failed to fetch wallet assets:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchTransactions = async () => {
    if (walletType !== 'sub') return; // Only sub-wallets have this endpoint for now
    try {
      const response = await fetch(`/api/projects/${projectId}/wallets/${walletId}/transactions`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('eclipay_token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleMaxClick = (asset: Asset) => {
    setSendAmount(asset.balance);
  };

  const handleSendConfirm = async () => {
    if (!selectedToken || !recipientAddress || !sendAmount) return;

    setIsSending(true);
    setSendError('');
    setSendResult(null);

    try {
      let url: string;
      
      if (walletType === 'master') {
        url = `/api/projects/${projectId}/master-wallets/${walletId}/send`;
      } else {
        url = `/api/projects/${projectId}/wallets/${walletId}/send`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('eclipay_token')}`,
        },
        body: JSON.stringify({
          to: recipientAddress,
          amount: sendAmount,
          tokenType: selectedToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send transaction');
      }

      setSendResult(data);
      setShowSendForm(false);
      setShowConfirmation(false);
      setRecipientAddress('');
      setSendAmount('');
      setSelectedToken('');
      
      // Refresh assets after successful send
      setTimeout(() => { fetchWalletAssets(); fetchTransactions(); }, 2000);
    } catch (error: any) {
      setSendError(error.message || 'Failed to send transaction');
    } finally {
      setIsSending(false);
    }
  };

  const getTokenDisplayName = (asset: Asset) => {
    return asset.type === 'native' ? asset.token : 'USDT';
  };

  const getTypeBadge = (type: string, approved: boolean) => {
    const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
    
    if (type === 'master') {
      return `${baseClasses} bg-purple-900 text-purple-300`;
    } else if (type === 'client') {
      return `${baseClasses} bg-blue-900 text-blue-300`;
    } else if (type === 'payment' && approved) {
      return `${baseClasses} bg-green-900 text-green-300`;
    } else {
      return `${baseClasses} bg-yellow-900 text-yellow-300`;
    }
  };

  const getTypeBadgeText = (type: string, approved: boolean) => {
    if (type === 'master') return 'Master';
    if (type === 'client') return 'Client';
    if (type === 'payment' && approved) return 'Payment';
    return 'Pending';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-700 rounded w-1/3"></div>
            <div className="h-32 bg-slate-700 rounded"></div>
            <div className="h-48 bg-slate-700 rounded"></div>
            <div className="h-48 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!walletAssets) {
    return (
      <div className="min-h-screen bg-slate-900 p-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-red-400">Failed to load wallet details</p>
          <button 
            onClick={() => router.back()} 
            className="mt-4 text-blue-400 hover:text-blue-300"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push('/');
              }
            }}
            className="flex items-center justify-center w-10 h-10 bg-slate-800 border border-slate-600 rounded-lg text-gray-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-12 h-12 bg-slate-700 rounded-lg">
              <span className="text-xl">{getChainIcon(walletAssets.wallet.chainId.toString())}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{walletAssets.wallet.chainName}</h1>
              <span className={getTypeBadge(walletAssets.wallet.type, walletAssets.wallet.approved)}>
                {getTypeBadgeText(walletAssets.wallet.type, walletAssets.wallet.approved)}
              </span>
            </div>
          </div>
        </div>

        {/* Wallet Address */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white mb-2">Wallet Address</h2>
              <code className="block bg-slate-700 border border-slate-600 rounded px-4 py-3 text-sm text-gray-300 font-mono break-all">
                {walletAssets.wallet.address}
              </code>
            </div>
            <button
              onClick={() => copyToClipboard(walletAssets.wallet.address)}
              className="ml-4 flex items-center justify-center w-10 h-10 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-gray-400 hover:text-white transition-colors"
              title="Copy address"
            >
              {copiedAddress ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Assets Section */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Assets</h2>
            <button
              onClick={fetchWalletAssets}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-sm text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="space-y-3">
            {walletAssets.assets.map((asset, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-slate-700 border border-slate-600 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-slate-600 rounded-lg">
                    <span className="text-sm font-bold">{asset.type === 'native' ? getChainIcon(walletAssets.wallet.chainId.toString()) : '₮'}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white">{getTokenDisplayName(asset)}</p>
                    <p className="text-xs text-gray-400">{asset.type === 'native' ? 'Native Token' : 'Stablecoin'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">
                    {parseFloat(asset.balance).toFixed(6)} {getTokenDisplayName(asset)}
                  </p>
                  <p className="text-xs text-gray-400">≈ $0.00</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Send Token Section */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Send Tokens</h2>
            {!showSendForm && (
              <button
                onClick={() => setShowSendForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
              >
                <Send className="h-4 w-4" />
                <span>Send</span>
              </button>
            )}
          </div>

          {showSendForm && (
            <div className="space-y-4">
              {/* Token Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Token</label>
                <select
                  value={selectedToken}
                  onChange={(e) => setSelectedToken(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select token to send</option>
                  {walletAssets.assets.map((asset, index) => (
                    <option key={index} value={asset.type}>
                      {getTokenDisplayName(asset)} (Balance: {parseFloat(asset.balance).toFixed(6)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipient Address */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Recipient Address</label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="Enter recipient address"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Amount</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.000001"
                    min="0"
                  />
                  {selectedToken && (
                    <button
                      onClick={() => {
                        const asset = walletAssets.assets.find(a => a.type === selectedToken);
                        if (asset) handleMaxClick(asset);
                      }}
                      className="px-3 py-2 bg-slate-600 hover:bg-slate-500 border border-slate-500 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
                    >
                      Max
                    </button>
                  )}
                </div>
              </div>

              {sendError && (
                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{sendError}</p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowSendForm(false);
                    setSendError('');
                    setRecipientAddress('');
                    setSendAmount('');
                    setSelectedToken('');
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowConfirmation(true)}
                  disabled={!selectedToken || !recipientAddress || !sendAmount || parseFloat(sendAmount) <= 0}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                >
                  Review Send
                </button>
              </div>
            </div>
          )}

          {/* Send Result */}
          {sendResult && (
            <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="font-semibold text-green-400">Transaction Sent Successfully</span>
              </div>
              <p className="text-sm text-gray-300 mb-2">
                Transaction Hash: 
                <code className="ml-2 text-green-400 font-mono">{formatAddress(sendResult.txHash, 16)}</code>
              </p>
              {sendResult.explorer && sendResult.explorer !== '#' && (
                <a
                  href={sendResult.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <span>View on Explorer</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4">
              <div className="fixed inset-0 bg-black opacity-50" onClick={() => setShowConfirmation(false)}></div>
              <div className="relative bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-white mb-4">Confirm Transaction</h3>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Token:</span>
                    <span className="text-white">
                      {walletAssets.assets.find(a => a.type === selectedToken)?.token || selectedToken}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount:</span>
                    <span className="text-white">{sendAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">To:</span>
                    <span className="text-white font-mono text-sm">{formatAddress(recipientAddress, 12)}</span>
                  </div>
                </div>

                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mb-6">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ This transaction cannot be undone. Please verify all details before confirming.
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowConfirmation(false)}
                    disabled={isSending}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendConfirm}
                    disabled={isSending}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                  >
                    {isSending ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </div>
                    ) : (
                      'Confirm Send'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

          {/* Transaction History */}
          {transactions.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Transaction History</h3>
              <div className="space-y-3">
                {transactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${tx.type === 'deposit' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                          {tx.type === 'deposit' ? '↓ IN' : '↑ OUT'}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${tx.status === 'confirmed' ? 'bg-green-900/30 text-green-400' : tx.status === 'failed' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                          {tx.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 font-mono truncate">
                        {tx.type === 'withdrawal' ? `→ ${tx.toAddress}` : `← ${tx.fromAddress}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className={`font-semibold ${tx.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.type === 'deposit' ? '+' : '-'}{parseFloat(tx.amount).toFixed(6)} {tx.token || 'USDT'}
                      </p>
                      {tx.explorer && tx.txHash !== 'pending_detection' && (
                        <a href={tx.explorer} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-400 hover:text-primary-300">
                          View ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}