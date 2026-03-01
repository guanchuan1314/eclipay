'use client';

import { useState, useEffect } from 'react';
import { Plus, Copy, QrCode, ExternalLink, X } from 'lucide-react';
import { invoicesApi, chainsApi, projectsApi } from '@/lib/api';
import { Invoice, Chain, Project } from '@/types';
import { 
  formatCurrency, 
  formatDate, 
  formatAddress, 
  getChainIcon, 
  getStatusBadgeClass,
  formatRelativeTime 
} from '@/lib/utils';

interface InvoicesPageProps {
  projectId: string;
}

export default function InvoicesPage({ projectId }: InvoicesPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [newInvoiceId, setNewInvoiceId] = useState<number | null>(null);
  
  // Create invoice form
  const [createForm, setCreateForm] = useState({
    chainId: '',
    amount: '',
    expiresIn: 24, // hours
  });

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      // First get the project to determine environment
      const projectData = await projectsApi.getById(projectId);
      setProject(projectData);

      const isTestnet = projectData.environment === 'testnet';

      const [invoicesData, chainsData] = await Promise.all([
        invoicesApi.getAll(projectId),
        chainsApi.getAll(isTestnet),
      ]);
      
      setInvoices(invoicesData);
      setChains(Array.isArray(chainsData) ? chainsData : []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!createForm.chainId || !createForm.amount) return;
    
    setIsCreating(true);
    try {
      const newInvoice = await invoicesApi.create(projectId, {
        chainId: createForm.chainId,
        amount: createForm.amount,
        expiresIn: createForm.expiresIn * 60 * 60, // convert hours to seconds
      });
      
      setInvoices([newInvoice, ...invoices]);
      setShowCreateModal(false);
      setCreateForm({ chainId: '', amount: '', expiresIn: 24 });
      setNewInvoiceId(newInvoice.id);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 5000);
    } catch (error) {
      console.error('Failed to create invoice:', error);
      // TODO: Show error feedback to user
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelInvoice = async (id: number) => {
    try {
      await invoicesApi.cancel(projectId, id.toString());
      setInvoices(invoices.map(invoice => 
        invoice.id === id ? { ...invoice, status: 'cancelled' } : invoice
      ));
    } catch (error) {
      console.error('Failed to cancel invoice:', error);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(type);
      setTimeout(() => setCopiedText(''), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const isExpired = (expiredAt: string) => {
    return new Date(expiredAt) < new Date();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
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
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-gray-400 mt-1">Create and manage payment invoices</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </button>
      </div>

      {/* Invoices List */}
      {invoices.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-slate-600 rounded-lg flex items-center justify-center mb-4">
            <span className="text-xl">📄</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No invoices yet</h3>
          <p className="text-gray-400 mb-6">Create your first invoice to start requesting payments</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Your First Invoice
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => {
            const chain = chains.find(c => c.id === invoice.chainId);
            const expired = isExpired(invoice.expiredAt);
            const canBePaid = invoice.status === 'pending' && !expired;
            
            return (
              <div key={invoice.id} className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-slate-600 rounded-lg mr-4">
                      <span className="text-xl">{getChainIcon(invoice.chainId.toString())}</span>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-semibold text-white">
                          {formatCurrency(invoice.amount)}
                        </h3>
                        <span className={getStatusBadgeClass(invoice.status)}>
                          {invoice.status}
                        </span>
                        {expired && invoice.status === 'pending' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-300">
                            Expired
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        {chain?.name || `Chain ${invoice.chainId}`} • Created {formatRelativeTime(invoice.createdAt)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    {canBePaid && (
                      <button
                        onClick={() => copyToClipboard(
                          `${window.location.origin}/pay/${invoice.id}`,
                          `link-${invoice.id}`
                        )}
                        className="text-gray-400 hover:text-white p-2 rounded"
                        title="Copy payment link"
                      >
                        {copiedText === `link-${invoice.id}` ? (
                          <span className="text-green-400 text-xs">Copied!</span>
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    
                    {invoice.status === 'pending' && !expired && (
                      <button
                        onClick={() => handleCancelInvoice(invoice.id)}
                        className="text-red-400 hover:text-red-300 p-2 rounded"
                        title="Cancel invoice"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Invoice ID
                    </label>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-gray-300 font-mono">
                        #{invoice.id}
                      </code>
                      <button
                        onClick={() => copyToClipboard(invoice.id.toString(), `id-${invoice.id}`)}
                        className="p-2 text-gray-400 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded transition-colors"
                        title="Copy ID"
                      >
                        {copiedText === `id-${invoice.id}` ? (
                          <span className="text-green-400 text-xs">✓</span>
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        {invoice.status === 'pending' && !expired ? 'Expires' : 'Expired'}
                      </label>
                      <p className={`text-sm ${
                        expired && invoice.status === 'pending' ? 'text-red-400' : 'text-gray-300'
                      }`}>
                        {formatDate(invoice.expiredAt)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatRelativeTime(invoice.expiredAt)}
                      </p>
                    </div>
                    
                    {invoice.paidAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Paid At
                        </label>
                        <p className="text-sm text-green-400">
                          {formatDate(invoice.paidAt)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatRelativeTime(invoice.paidAt)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {canBePaid && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 mb-3">
                      <p className="text-sm text-blue-200 font-medium mb-2">Payment Link Ready</p>
                      <p className="text-xs text-blue-300/80 mb-2">
                        Share this secure payment link with your customer:
                      </p>
                      <div className="flex items-center space-x-2">
                        <code className="flex-1 bg-blue-900/40 border border-blue-700 rounded px-2 py-1 text-xs text-blue-200 font-mono break-all">
                          {`${window.location.origin}/pay/${invoice.id}`}
                        </code>
                        <button
                          onClick={() => copyToClipboard(
                            `${window.location.origin}/pay/${invoice.id}`,
                            `payment-link-${invoice.id}`
                          )}
                          className="p-1 text-blue-300 hover:text-blue-100 bg-blue-800 hover:bg-blue-700 border border-blue-600 rounded transition-colors"
                          title="Copy payment link"
                        >
                          {copiedText === `payment-link-${invoice.id}` ? (
                            <span className="text-green-400 text-xs">✓</span>
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => copyToClipboard(
                          `${window.location.origin}/pay/${invoice.id}`,
                          `share-${invoice.id}`
                        )}
                        className="btn-secondary text-xs flex items-center"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {copiedText === `share-${invoice.id}` ? 'Copied!' : 'Copy Payment Link'}
                      </button>
                      <button 
                        onClick={() => window.open(`/pay/${invoice.id}`, '_blank')}
                        className="btn-secondary text-xs flex items-center"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Payment Page
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setShowCreateModal(false)}></div>
            <div className="relative bg-slate-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">Create New Invoice</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Chain
                  </label>
                  <select
                    value={createForm.chainId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, chainId: e.target.value }))}
                    className="input-field w-full rounded-md"
                  >
                    <option value="">Select a blockchain...</option>
                    {chains.map((chain) => (
                      <option key={chain.id} value={chain.id.toString()}>
                        {getChainIcon(chain.id.toString())} {chain.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Amount (USDT)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={createForm.amount}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="input-field w-full rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Expires In (Hours)
                  </label>
                  <select
                    value={createForm.expiresIn}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, expiresIn: parseInt(e.target.value) }))}
                    className="input-field w-full rounded-md"
                  >
                    <option value={1}>1 hour</option>
                    <option value={6}>6 hours</option>
                    <option value={24}>24 hours (1 day)</option>
                    <option value={72}>72 hours (3 days)</option>
                    <option value={168}>1 week</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateInvoice}
                  disabled={!createForm.chainId || !createForm.amount || isCreating}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : null}
                  {isCreating ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {showSuccessMessage && newInvoiceId && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white p-4 rounded-lg shadow-lg max-w-sm">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <span className="text-xl">✅</span>
            </div>
            <div className="flex-1">
              <p className="font-medium mb-1">Invoice Created Successfully!</p>
              <p className="text-sm text-green-100 mb-2">
                Your payment link is ready to share with customers.
              </p>
              <button
                onClick={() => {
                  copyToClipboard(
                    `${window.location.origin}/pay/${newInvoiceId}`,
                    `success-copy-${newInvoiceId}`
                  );
                  setShowSuccessMessage(false);
                }}
                className="bg-green-500 hover:bg-green-400 text-white text-xs px-3 py-1 rounded transition-colors"
              >
                Copy Payment Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}