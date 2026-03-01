'use client';

import { useState } from 'react';
import { Coins, ExternalLink, AlertTriangle, CheckCircle, XCircle, Copy } from 'lucide-react';

interface AirdropResponse {
  success: boolean;
  signature: string;
  amount: number;
  address: string;
  explorer: string;
}

export default function FaucetPage() {
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AirdropResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/chains/solana/airdrop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: address.trim(),
          amount: parseFloat(amount.toString()),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Airdrop request failed');
      }

      setResult(data);
      setAddress(''); // Clear form on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setError(null);
    setAddress('');
    setAmount(1);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Coins className="h-10 w-10 text-purple-400 mr-3" />
            <span className="text-xl font-bold text-white">Solana Devnet Faucet</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Get Test SOL</h1>
          <p className="text-gray-400">Get free Solana devnet tokens for testing your applications</p>
        </div>

        {/* Testnet Notice */}
        <div className="max-w-lg mx-auto mb-6">
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-purple-400" />
              <span className="font-medium text-purple-300">TESTNET ONLY</span>
            </div>
            <p className="text-sm text-purple-200">
              ⚠️ This faucet provides Solana devnet tokens only. These have no real value and are for testing purposes.
            </p>
          </div>
        </div>

        <div className="max-w-lg mx-auto">
          {/* Success Result */}
          {result && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
              <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 text-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-200 font-medium">Airdrop Successful!</p>
                <p className="text-green-300/80 text-sm mt-1">
                  {result.amount} SOL sent to your address
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Transaction Signature
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-gray-300 font-mono break-all">
                      {result.signature}
                    </div>
                    <button
                      onClick={() => copyToClipboard(result.signature)}
                      className="p-2 text-gray-400 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded transition-colors"
                      title="Copy signature"
                    >
                      {copied ? (
                        <span className="text-green-400 text-xs">✓</span>
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Recipient Address
                  </label>
                  <div className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-gray-300 font-mono break-all">
                    {result.address}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <a
                    href={result.explorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on Explorer
                  </a>
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Request Another
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-center">
                <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <p className="text-red-200 font-medium">Airdrop Failed</p>
                <p className="text-red-300/80 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Airdrop Form */}
          {!result && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-400 mb-2">
                    Solana Address
                  </label>
                  <input
                    type="text"
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter Solana devnet address"
                    required
                    disabled={isLoading}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Example: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
                  </p>
                </div>

                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-400 mb-2">
                    Amount (SOL)
                  </label>
                  <input
                    type="number"
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    min="0.1"
                    max="2"
                    step="0.1"
                    required
                    disabled={isLoading}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum 2 SOL per request
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !address.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Requesting Airdrop...
                    </>
                  ) : (
                    <>
                      <Coins className="h-4 w-4 mr-2" />
                      Request Airdrop
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-200 mb-2">Usage Information</h4>
                <div className="text-sm text-blue-300/80 space-y-1">
                  <p>• Maximum 2 SOL per request</p>
                  <p>• Rate limited to 5 requests per minute</p>
                  <p>• Only works with valid Solana devnet addresses</p>
                  <p>• Tokens have no real value</p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-700 text-center text-sm text-gray-500">
            <p>Need help? Check the <a href="https://docs.solana.com/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">Solana Documentation</a></p>
            <p className="text-xs text-gray-600 mt-2">Powered by EcliPay</p>
          </div>
        </div>
      </div>
    </div>
  );
}