'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Copy, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatRelativeTime, getChainIcon } from '@/lib/utils';

interface PublicInvoice {
  id: number;
  amount: string;
  status: string;
  description?: string;
  chain: {
    id: number;
    name: string;
    symbol: string;
  };
  paymentAddress: string;
  expiredAt: string;
  createdAt: string;
  merchant: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
}

export default function PaymentPage() {
  const params = useParams();
  const invoiceId = params.id as string;
  
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  // Check if this is a testnet chain
  const isTestnetChain = (chainName: string) => {
    const testnetNames = ['Sepolia', 'Testnet', 'Amoy', 'Nile', 'Devnet', 'Fuji'];
    return testnetNames.some(testnet => chainName.includes(testnet));
  };

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  // Auto-refresh for pending payments
  useEffect(() => {
    if (!invoice || invoice.status !== 'pending' || isExpired) return;

    const interval = setInterval(() => {
      fetchInvoice(true);
    }, 5000); // Poll every 5 seconds (silent — no loading spinner)

    return () => clearInterval(interval);
  }, [invoice, isExpired]);

  // Update countdown timer
  useEffect(() => {
    if (!invoice) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(invoice.expiredAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        setIsExpired(true);
        clearInterval(timer);
      } else {
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeLeft(`${minutes}m ${seconds}s`);
        } else {
          setTimeLeft(`${seconds}s`);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [invoice]);

  const fetchInvoice = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const response = await fetch(`/api/invoices/${invoiceId}/public`);
      
      if (!response.ok) {
        throw new Error(response.status === 404 ? 'Invoice not found' : 'Failed to load invoice');
      }
      
      const data = await response.json();
      setInvoice(data);
      
      // Check if already expired
      const now = new Date().getTime();
      const expiry = new Date(data.expiredAt).getTime();
      setIsExpired(expiry <= now);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return isExpired ? 'text-red-400' : 'text-yellow-400';
      case 'paid':
        return 'text-green-400';
      case 'expired':
      case 'cancelled':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return isExpired ? <XCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />;
      case 'paid':
        return <CheckCircle className="h-5 w-5" />;
      case 'expired':
      case 'cancelled':
        return <XCircle className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const canPay = invoice && invoice.status === 'pending' && !isExpired;
  const qrCodeUrl = invoice ? `https://api.qrserver.com/v1/create-qr-code/?data=${invoice.paymentAddress}&size=200x200&bgcolor=1e293b&color=ffffff` : '';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Payment Not Found</h1>
            <p className="text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            {invoice?.merchant.logoUrl ? (
              <img 
                src={invoice.merchant.logoUrl} 
                alt={`${invoice.merchant.name} logo`}
                className="h-10 max-w-32 object-contain mr-3"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = document.createElement('span');
                  fallback.className = 'text-2xl mr-2';
                  fallback.textContent = '💳';
                  target.parentNode!.insertBefore(fallback, target);
                }}
              />
            ) : (
              <span className="text-2xl mr-2">💳</span>
            )}
            <span className="text-xl font-bold text-white">{invoice?.merchant.name || 'Payment Request'}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Request</h1>
          {invoice?.description && (
            <p className="text-lg text-gray-300 mb-2">{invoice.description}</p>
          )}
          <p className="text-gray-400">Complete your payment using cryptocurrency</p>
        </div>

        {/* Testnet Banner */}
        {invoice && isTestnetChain(invoice.chain.name) && (
          <div className="max-w-lg mx-auto mb-6">
            <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                <span className="font-medium text-orange-300">TEST PAYMENT</span>
              </div>
              <p className="text-sm text-orange-200">
                ⚠️ This is a test payment on {invoice.chain.name}. No real funds are required.
              </p>
            </div>
          </div>
        )}

        <div className="max-w-lg mx-auto">
          {/* Payment Details Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
            {/* Status */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <span className={getStatusColor(invoice.status)}>
                  {getStatusIcon(invoice.status)}
                </span>
                <span className={`font-medium ${getStatusColor(invoice.status)}`}>
                  {isExpired && invoice.status === 'pending' ? 'Expired' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </span>
              </div>
              
              {invoice.status === 'pending' && !isExpired && (
                <button
                  onClick={fetchInvoice}
                  className="p-2 text-gray-400 hover:text-white rounded transition-colors"
                  title="Refresh status"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Amount */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center mb-2">
                <span className="text-2xl mr-2">{getChainIcon(invoice.chain.id.toString())}</span>
                <span className="text-sm text-gray-400">{invoice.chain.name}</span>
              </div>
              <div className="text-4xl font-bold text-white mb-1">
                {formatCurrency(invoice.amount)}
              </div>
              <p className="text-sm text-gray-400">Amount to pay</p>
            </div>

            {/* Expiration Timer */}
            {invoice.status === 'pending' && (
              <div className="text-center mb-6">
                <div className={`text-lg font-mono ${isExpired ? 'text-red-400' : 'text-yellow-400'}`}>
                  {timeLeft || 'Loading...'}
                </div>
                <p className="text-xs text-gray-500">
                  {isExpired ? 'Payment expired' : 'Time remaining'}
                </p>
              </div>
            )}

            {canPay && (
              <>
                {/* QR Code */}
                <div className="text-center mb-6">
                  <div className="inline-block p-3 bg-white rounded-lg">
                    <img 
                      src={qrCodeUrl} 
                      alt="Payment QR Code" 
                      className="w-48 h-48 mx-auto"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Scan with your wallet app</p>
                </div>

                {/* Payment Address */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Payment Address
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-gray-300 font-mono break-all">
                      {invoice.paymentAddress}
                    </div>
                    <button
                      onClick={() => copyToClipboard(invoice.paymentAddress)}
                      className="p-2 text-gray-400 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded transition-colors"
                      title="Copy address"
                    >
                      {copied ? (
                        <span className="text-green-400 text-xs">✓</span>
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-medium text-blue-200 mb-2">Payment Instructions</h4>
                  <div className="text-sm text-blue-300/80 space-y-1">
                    <p>1. Send exactly <strong>{formatCurrency(invoice.amount)}</strong> to the address above</p>
                    <p>2. Use the <strong>{invoice.chain.name}</strong> network</p>
                    <p>3. Payment will be confirmed automatically</p>
                    <p>4. Do not send any other tokens or amounts</p>
                  </div>
                </div>
              </>
            )}

            {invoice.status === 'paid' && (
              <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 text-center">
                <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-200 font-medium">Payment to {invoice.merchant.name} completed!</p>
                <p className="text-green-300/80 text-sm mt-1">Thank you for your payment</p>
                {(invoice.merchant.email || invoice.merchant.phone) && (
                  <div className="mt-3 pt-3 border-t border-green-800 text-sm text-green-300/80">
                    <p className="mb-1">Need support? Contact us:</p>
                    {invoice.merchant.email && (
                      <p>📧 <a href={`mailto:${invoice.merchant.email}`} className="text-green-300 hover:text-green-200">{invoice.merchant.email}</a></p>
                    )}
                    {invoice.merchant.phone && (
                      <p>📞 <a href={`tel:${invoice.merchant.phone}`} className="text-green-300 hover:text-green-200">{invoice.merchant.phone}</a></p>
                    )}
                  </div>
                )}
              </div>
            )}

            {(isExpired || invoice.status === 'expired' || invoice.status === 'cancelled') && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-center">
                <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <p className="text-red-200 font-medium">
                  Payment to {invoice.merchant.name} {invoice.status === 'cancelled' ? 'cancelled' : 'expired'}
                </p>
                <p className="text-red-300/80 text-sm mt-1">
                  This payment request is no longer valid
                </p>
                {(invoice.merchant.email || invoice.merchant.phone) && (
                  <div className="mt-3 pt-3 border-t border-red-800 text-sm text-red-300/80">
                    <p className="mb-1">Need support? Contact us:</p>
                    {invoice.merchant.email && (
                      <p>📧 <a href={`mailto:${invoice.merchant.email}`} className="text-red-300 hover:text-red-200">{invoice.merchant.email}</a></p>
                    )}
                    {invoice.merchant.phone && (
                      <p>📞 <a href={`tel:${invoice.merchant.phone}`} className="text-red-300 hover:text-red-200">{invoice.merchant.phone}</a></p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Invoice Details */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Payment Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice ID:</span>
                <span className="text-gray-300 font-mono">#{invoice.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created:</span>
                <span className="text-gray-300">{formatRelativeTime(invoice.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Network:</span>
                <span className="text-gray-300">{invoice.chain.name}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-700 text-center text-sm text-gray-500">
            {invoice?.merchant.address && (
              <div className="mb-4">
                <p className="text-gray-400 mb-1">{invoice.merchant.name}</p>
                <p className="whitespace-pre-line">{invoice.merchant.address}</p>
              </div>
            )}
            {(invoice?.merchant.email || invoice?.merchant.phone) && (
              <div className="mb-4 space-y-1">
                {invoice.merchant.email && (
                  <p>📧 <a href={`mailto:${invoice.merchant.email}`} className="text-gray-400 hover:text-gray-300">{invoice.merchant.email}</a></p>
                )}
                {invoice.merchant.phone && (
                  <p>📞 <a href={`tel:${invoice.merchant.phone}`} className="text-gray-400 hover:text-gray-300">{invoice.merchant.phone}</a></p>
                )}
              </div>
            )}
            <p className="text-xs text-gray-600">Powered by EcliPay</p>
          </div>
        </div>
      </div>
    </div>
  );
}