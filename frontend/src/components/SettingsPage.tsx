'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, Eye, EyeOff, RefreshCw, Save, AlertTriangle, Upload, X } from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { Project, User } from '@/types';
import { formatAddress, getChainIcon } from '@/lib/utils';

interface SettingsPageProps {
  project: Project;
  user: User;
  onProjectUpdate: () => void;
}

export default function SettingsPage({ project, user, onProjectUpdate }: SettingsPageProps) {
  const [projectName, setProjectName] = useState(project.name);
  const [webhookUrl, setWebhookUrl] = useState(project.webhookUrl || '');
  const [logoUrl, setLogoUrl] = useState(project.logoUrl || '');
  const [businessName, setBusinessName] = useState(project.businessName || '');
  const [businessAddress, setBusinessAddress] = useState(project.businessAddress || '');
  const [contactEmail, setContactEmail] = useState(project.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(project.contactPhone || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [copiedItem, setCopiedItem] = useState('');
  const [saved, setSaved] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [currentApiKey, setCurrentApiKey] = useState('');
  const [hasGeneratedNewKey, setHasGeneratedNewKey] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [masterWallets, setMasterWallets] = useState<any[]>([]);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    setProjectName(project.name);
    setWebhookUrl(project.webhookUrl || '');
    setLogoUrl(project.logoUrl || '');
    setBusinessName(project.businessName || '');
    setBusinessAddress(project.businessAddress || '');
    setContactEmail(project.contactEmail || '');
    setContactPhone(project.contactPhone || '');
    // Don't reload settings if we just generated a new key (would overwrite it with masked value)
    if (!hasGeneratedNewKey) {
      loadSettings();
    }
  }, [project]);

  const loadSettings = async () => {
    try {
      setIsLoadingSettings(true);
      const [settings, masterWalletsData] = await Promise.all([
        projectsApi.getSettings(project.id),
        fetch(`/api/projects/${project.id}/master-wallets`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('eclipay_token')}`,
          },
        }).then(res => res.json()).catch(() => [])
      ]);
      
      setCurrentApiKey(settings.apiKey);
      setWebhookUrl(settings.webhookUrl || '');
      setBusinessName(settings.businessName || '');
      setBusinessAddress(settings.businessAddress || '');
      setContactEmail(settings.contactEmail || '');
      setContactPhone(settings.contactPhone || '');
      setMasterWallets(masterWalletsData);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleSave = async () => {
    const trimmedWebhook = webhookUrl.trim();
    if (trimmedWebhook && !/^https?:\/\/.+\..+/.test(trimmedWebhook)) {
      alert('Webhook URL must be a valid URL (e.g. https://example.com/webhook)');
      return;
    }
    setIsSaving(true);
    try {
      await projectsApi.updateSettings(project.id, {
        name: projectName.trim(),
        webhookUrl: trimmedWebhook || undefined,
        businessName: businessName.trim() || undefined,
        businessAddress: businessAddress.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onProjectUpdate(); // Refresh project list
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    setIsRegeneratingKey(true);
    try {
      const response = await projectsApi.regenerateKey(String(project.id));
      const newKey = response.apiKey;
      if (!newKey) {
        alert('Error: No API key returned from server. Response: ' + JSON.stringify(response));
        return;
      }
      setCurrentApiKey(newKey);
      setHasGeneratedNewKey(true);
      setShowApiKey(true);
      setShowRegenerateConfirm(false);
    } catch (error: any) {
      alert('Failed to regenerate API key: ' + (error?.message || String(error)));
      console.error('Failed to regenerate API key:', error);
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  const copyToClipboard = async (text: string, item: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(item);
      setTimeout(() => setCopiedItem(''), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert('File too large. Max 2MB.');
      return;
    }
    
    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      
      const response = await fetch(`/api/projects/${project.id}/logo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('eclipay_token')}` },
        body: formData,
      });
      
      if (response.ok) {
        const updatedProject = await response.json();
        setLogoUrl(updatedProject.logoUrl || '');
        onProjectUpdate(); // Refresh project list
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Failed to upload logo:', error);
      alert('Failed to upload logo. Please try again.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/logo`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('eclipay_token')}` },
      });
      
      if (response.ok) {
        setLogoUrl('');
        onProjectUpdate(); // Refresh project list
      } else {
        throw new Error('Remove failed');
      }
    } catch (error) {
      console.error('Failed to remove logo:', error);
      alert('Failed to remove logo. Please try again.');
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.match(/^image\/(jpg|jpeg|png|gif|webp|svg\+xml)$/)) {
        handleLogoUpload(file);
      } else {
        alert('Please upload an image file (.jpg, .jpeg, .png, .gif, .webp, .svg)');
      }
    }
  }, []);

  const maskedApiKey = currentApiKey ? '••••••••••••••••••••••••••••••••' : 'Loading...';
  const canCopyApiKey = hasGeneratedNewKey || showApiKey;

  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Project Settings</h1>
        <p className="text-gray-400 mt-1">Manage your project configuration</p>
      </div>

      {/* Business Profile */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Business Profile</h3>
        <p className="text-gray-400 mb-4">
          This information will be displayed on your payment pages to customers.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Logo Upload
            </label>
            
            {/* Upload Area */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                dragActive
                  ? 'border-primary-500 bg-primary-50/5'
                  : 'border-slate-600 hover:border-slate-500'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                id="logo-upload"
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.svg"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleLogoUpload(e.target.files[0]);
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isUploadingLogo}
              />
              
              <div className="text-center">
                {isUploadingLogo ? (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-3"></div>
                    <p className="text-gray-400 text-sm">Uploading logo...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 text-gray-400 mb-3" />
                    <p className="text-gray-400 text-sm mb-1">
                      Drop your logo here or <span className="text-primary-400">click to browse</span>
                    </p>
                    <p className="text-gray-500 text-xs">
                      Supports JPG, PNG, GIF, WebP, SVG • Max 2MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Current Logo Preview */}
            {logoUrl && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">Current Logo:</p>
                  <button
                    onClick={handleLogoRemove}
                    className="text-red-400 hover:text-red-300 text-xs flex items-center"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Remove
                  </button>
                </div>
                <div className="bg-slate-700 rounded-lg p-4 w-fit">
                  <img 
                    src={logoUrl} 
                    alt="Current logo" 
                    className="h-12 max-w-32 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const errorMsg = target.parentElement?.querySelector('.error-msg');
                      if (errorMsg) errorMsg.classList.remove('hidden');
                    }}
                  />
                  <p className="text-red-400 text-sm hidden error-msg">Failed to load logo</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Business Name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="input-field w-full rounded-md"
              placeholder="Your Business Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Contact Email
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="input-field w-full rounded-md"
              placeholder="support@yourbusiness.com"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Business Address
            </label>
            <textarea
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              className="input-field w-full rounded-md"
              rows={3}
              placeholder="123 Business Street&#10;City, State 12345&#10;Country"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Contact Phone
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="input-field w-full rounded-md"
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </div>
      </div>

      {/* Project Information */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Project Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Project Name *
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="input-field w-full rounded-md"
              placeholder="Project name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Project ID
            </label>
            <div className="flex items-center space-x-2">
              <code className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-gray-300 font-mono">
                {project.id}
              </code>
              <button
                onClick={() => copyToClipboard(project.id, 'projectId')}
                className="p-2 text-gray-400 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded transition-colors"
                title="Copy project ID"
              >
                {copiedItem === 'projectId' ? (
                  <span className="text-green-400 text-xs">✓</span>
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Owner
            </label>
            <div className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-gray-300">
              {user.username} ({user.email})
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Created
            </label>
            <div className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-gray-300">
              {new Date(project.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Master Wallets */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Master Wallets</h3>
        <p className="text-gray-400 mb-4">
          These are the master wallets for each blockchain. All payments from sub-wallets are automatically collected here.
        </p>
        
        {masterWallets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {masterWallets.map((masterWallet) => (
              <div key={masterWallet.id} className="bg-slate-700 border border-slate-600 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-slate-600 rounded-lg mr-3">
                    <span className="text-sm">{getChainIcon(masterWallet.chainId.toString())}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{masterWallet.chainName}</h4>
                    <span className="text-xs text-gray-400">Master Wallet</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Address
                    </label>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-gray-300 font-mono">
                        {formatAddress(masterWallet.address, 8)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(masterWallet.address, `settings-master-${masterWallet.id}`)}
                        className="p-1 text-gray-400 hover:text-white bg-slate-800 hover:bg-slate-600 border border-slate-600 rounded transition-colors"
                        title="Copy address"
                      >
                        {copiedItem === `settings-master-${masterWallet.id}` ? (
                          <span className="text-green-400 text-xs">✓</span>
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 text-center">
            <div className="mx-auto w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center mb-3">
              <span className="text-lg">⚡</span>
            </div>
            <p className="text-gray-300 text-sm">Master wallets are being generated...</p>
          </div>
        )}
      </div>

      {/* API Key Management */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">API Key</h3>
        <p className="text-gray-400 mb-4">
          Use this API key to authenticate requests to the EcliPay API. Keep it secure and never share it publicly.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Your API Key
            </label>
            <div className="flex items-center space-x-2">
              <code className="flex-1 min-w-0 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-gray-300 font-mono truncate overflow-hidden">
                {showApiKey ? currentApiKey : maskedApiKey}
              </code>
              {hasGeneratedNewKey && (
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-2 text-gray-400 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded transition-colors"
                  title={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={() => copyToClipboard(currentApiKey, 'apiKey')}
                disabled={!canCopyApiKey}
                className="p-2 text-gray-400 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Copy API key"
              >
                {copiedItem === 'apiKey' ? (
                  <span className="text-green-400 text-xs">✓</span>
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            {!hasGeneratedNewKey ? (
              <p className="text-xs text-gray-500 mt-1">
                Regenerate to reveal and copy your API key
              </p>
            ) : (
              <p className="text-xs text-green-400 mt-1">
                Key generated! Copy it now, it won't be shown again.
              </p>
            )}
          </div>

          <div className="flex items-start space-x-3 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
            <div className="text-sm">
              <p className="text-yellow-200 font-medium mb-1">Important Security Notice</p>
              <p className="text-yellow-300/80">
                If you regenerate your API key, you'll need to update it in all your applications. 
                The old key will stop working immediately.
              </p>
            </div>
          </div>

          <div>
            <button
              onClick={() => setShowRegenerateConfirm(true)}
              className="btn-secondary flex items-center text-red-400 hover:text-red-300 hover:bg-red-900/20"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate API Key
            </button>
          </div>
        </div>
      </div>

      {/* Project Settings */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Project Configuration</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Webhook URL (Optional)
            </label>
            <input
              type="url"
              placeholder=""
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="input-field w-full rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              This URL will receive POST requests with payment event data
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSave}
                disabled={isSaving || !projectName.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isSaving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
              
              {saved && (
                <span className="text-green-400 text-sm flex items-center">
                  <span className="mr-1">✓</span>
                  Saved successfully
                </span>
              )}
            </div>
          </div>

          <div className="bg-slate-700 border border-slate-600 rounded-lg p-4">
            <h4 className="text-sm font-medium text-white mb-2">Webhook Events</h4>
            <div className="space-y-1 text-sm text-gray-300">
              <div>• <code>payment.received</code> - When a payment is detected</div>
              <div>• <code>payment.confirmed</code> - When a payment is confirmed on-chain</div>
              <div>• <code>invoice.paid</code> - When an invoice is successfully paid</div>
              <div>• <code>invoice.expired</code> - When an invoice expires</div>
            </div>
          </div>
        </div>
      </div>

      {/* Regenerate API Key Confirmation Modal */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setShowRegenerateConfirm(false)}></div>
            <div className="relative bg-slate-800 rounded-lg p-6 w-full max-w-md border border-red-800">
              <div className="flex items-start space-x-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-400 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-white">Regenerate API Key?</h3>
                  <p className="text-gray-400 mt-1">This action cannot be undone.</p>
                </div>
              </div>
              
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
                <ul className="text-sm text-red-300 space-y-1">
                  <li>• Your current API key will stop working immediately</li>
                  <li>• You'll need to update all applications using this key</li>
                  <li>• Active API requests may fail until updated</li>
                </ul>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowRegenerateConfirm(false)}
                  className="btn-secondary"
                  disabled={isRegeneratingKey}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegenerateApiKey}
                  disabled={isRegeneratingKey}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isRegeneratingKey ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {isRegeneratingKey ? 'Regenerating...' : 'Regenerate Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New API Key Modal - stays open until explicitly dismissed */}
      {hasGeneratedNewKey && currentApiKey && currentApiKey.startsWith('eclipay_live_') && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-black opacity-70"></div>
            <div className="relative bg-slate-800 rounded-lg p-6 w-full max-w-lg border border-green-700">
              <div className="text-center mb-4">
                <div className="text-green-400 text-4xl mb-2">🔑</div>
                <h3 className="text-xl font-bold text-white">New API Key Generated</h3>
                <p className="text-yellow-400 text-sm mt-2 font-medium">
                  ⚠️ Copy this key now! It will NOT be shown again after you close this dialog.
                </p>
              </div>
              
              <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 mb-4">
                <code className="text-green-400 text-sm font-mono break-all select-all">
                  {currentApiKey}
                </code>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentApiKey);
                    setCopiedItem('newKeyModal');
                    setTimeout(() => setCopiedItem(''), 3000);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center"
                >
                  {copiedItem === 'newKeyModal' ? (
                    <><span className="mr-2">✓</span> Copied!</>
                  ) : (
                    <><Copy className="h-4 w-4 mr-2" /> Copy API Key</>
                  )}
                </button>
                <button
                  onClick={() => setHasGeneratedNewKey(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-gray-300 font-medium py-3 px-4 rounded-md transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}