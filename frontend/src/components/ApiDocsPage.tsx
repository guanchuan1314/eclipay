'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface ApiDocsPageProps {
  projectId: string | number;
}

interface Endpoint {
  method: string;
  path: string;
  description: string;
  auth: string;
  body?: Record<string, string>;
  response?: string;
}

const sections = [
  {
    title: 'Authentication',
    description: 'Use your project API key in the X-API-Key header for all requests.',
    endpoints: [] as Endpoint[],
    note: 'All endpoints require the header: `X-API-Key: your_project_api_key`',
  },
  {
    title: 'Invoices',
    description: 'Create and manage payment invoices.',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/invoices',
        description: 'Create a new payment invoice',
        auth: 'X-API-Key',
        body: {
          chainId: 'number — Chain ID (1=Ethereum, 2=BSC, 3=Polygon, 4=Arbitrum, 5=Optimism, 6=Avalanche, 7=Tron, 8=Solana)',
          amount: 'string — USDT amount (e.g. "100.00")',
          externalId: 'string (optional) — Your reference ID',
          callbackUrl: 'string (optional) — Override webhook URL for this invoice',
          expiresIn: 'number (optional) — Expiry in minutes (default: 60)',
        },
        response: `{
  "id": 1,
  "chainId": 7,
  "amount": "100.00",
  "status": "pending",
  "paymentAddress": "TXyz...abc",
  "expiresAt": "2026-02-27T08:00:00.000Z",
  "createdAt": "2026-02-27T07:00:00.000Z"
}`,
      },
      {
        method: 'GET',
        path: '/api/v1/invoices/:id',
        description: 'Get invoice by ID',
        auth: 'X-API-Key',
        response: `{
  "id": 1,
  "chainId": 7,
  "amount": "100.00",
  "status": "pending | paid | expired | cancelled",
  "paymentAddress": "TXyz...abc",
  "txHash": null,
  "paidAt": null,
  "expiresAt": "2026-02-27T08:00:00.000Z"
}`,
      },
      {
        method: 'GET',
        path: '/api/v1/invoices',
        description: 'List all invoices',
        auth: 'X-API-Key',
        response: `[{ "id": 1, "amount": "100.00", "status": "pending", ... }]`,
      },
      {
        method: 'PATCH',
        path: '/api/v1/invoices/:id/cancel',
        description: 'Cancel a pending invoice',
        auth: 'X-API-Key',
      },
    ],
  },
  {
    title: 'Transactions',
    description: 'View transaction history.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/transactions',
        description: 'List all transactions',
        auth: 'X-API-Key',
        response: `[{
  "id": 1,
  "chainId": 7,
  "txHash": "abc123...",
  "from": "TXyz...sender",
  "to": "TXyz...receiver",
  "amount": "100.00",
  "type": "deposit | withdrawal",
  "status": "pending | confirmed | failed",
  "createdAt": "2026-02-27T07:00:00.000Z"
}]`,
      },
      {
        method: 'GET',
        path: '/api/v1/transactions/:id',
        description: 'Get transaction by ID',
        auth: 'X-API-Key',
      },
    ],
  },
  {
    title: 'Chains',
    description: 'Get supported blockchain information.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/chains',
        description: 'List supported chains',
        auth: 'X-API-Key',
        response: `[{
  "id": 1, "name": "Ethereum", "standard": "EVM", "gasToken": "ETH", "enabled": true
}, ...]`,
      },
    ],
  },
  {
    title: 'Webhooks',
    description: 'EcliPay sends POST requests to your webhook URL when payment events occur.',
    endpoints: [],
    note: `**Webhook Payload:**
\`\`\`json
{
  "event": "invoice.paid",
  "data": {
    "invoiceId": 1,
    "amount": "100.00",
    "chainId": 7,
    "txHash": "abc123...",
    "paidAt": "2026-02-27T07:30:00.000Z"
  },
  "timestamp": "2026-02-27T07:30:01.000Z"
}
\`\`\`

**Events:**
- \`invoice.paid\` — Invoice payment confirmed
- \`invoice.expired\` — Invoice expired without payment
- \`transaction.confirmed\` — Deposit transaction confirmed

**Verification:**
Each webhook includes an \`X-EcliPay-Signature\` header with an HMAC-SHA256 signature using your API key. Verify this to ensure the webhook is authentic.

**Retry Policy:**
Failed webhooks are retried up to 3 times with exponential backoff (10s, 60s, 300s).`,
  },
];

const methodColors: Record<string, string> = {
  GET: 'bg-green-900 text-green-300',
  POST: 'bg-blue-900 text-blue-300',
  PATCH: 'bg-yellow-900 text-yellow-300',
  DELETE: 'bg-red-900 text-red-300',
  PUT: 'bg-purple-900 text-purple-300',
};

export default function ApiDocsPage({ projectId }: ApiDocsPageProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1, 2, 3, 4]));
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set());
  const [copiedText, setCopiedText] = useState('');

  const toggleSection = (index: number) => {
    const next = new Set(expandedSections);
    next.has(index) ? next.delete(index) : next.add(index);
    setExpandedSections(next);
  };

  const toggleEndpoint = (key: string) => {
    const next = new Set(expandedEndpoints);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpandedEndpoints(next);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(''), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">API Documentation</h2>
        <p className="text-gray-400 mt-1">
          Integrate EcliPay into your application using these endpoints.
        </p>
      </div>

      {/* Base URL */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-400">Base URL</span>
            <p className="text-white font-mono text-sm mt-1">https://payment-gateway.guanchuanlee.com</p>
          </div>
          <button
            onClick={() => copyToClipboard('https://payment-gateway.guanchuanlee.com')}
            className="p-2 text-gray-400 hover:text-white"
          >
            {copiedText === 'https://payment-gateway.guanchuanlee.com' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Sections */}
      {sections.map((section, si) => (
        <div key={si} className="card overflow-hidden">
          <button
            onClick={() => toggleSection(si)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50"
          >
            <h3 className="text-lg font-semibold text-white">{section.title}</h3>
            {expandedSections.has(si) ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
          </button>

          {expandedSections.has(si) && (
            <div className="border-t border-slate-700 p-4 space-y-4">
              <p className="text-gray-400 text-sm">{section.description}</p>

              {section.note && (
                <div className="bg-slate-800 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap font-mono">
                  {section.note}
                </div>
              )}

              {section.endpoints.map((ep, ei) => {
                const key = `${si}-${ei}`;
                return (
                  <div key={key} className="border border-slate-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleEndpoint(key)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-700/30"
                    >
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${methodColors[ep.method]}`}>
                        {ep.method}
                      </span>
                      <span className="text-white font-mono text-sm">{ep.path}</span>
                      <span className="text-gray-500 text-sm ml-auto mr-2">{ep.description}</span>
                      {expandedEndpoints.has(key) ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                    </button>

                    {expandedEndpoints.has(key) && (
                      <div className="border-t border-slate-700 p-4 space-y-3 bg-slate-800/50">
                        <div className="text-xs text-gray-500">Auth: {ep.auth}</div>

                        {ep.body && (
                          <div>
                            <div className="text-sm font-medium text-gray-300 mb-2">Request Body</div>
                            <div className="bg-slate-900 rounded p-3 text-sm font-mono space-y-1">
                              {Object.entries(ep.body).map(([k, v]) => (
                                <div key={k}>
                                  <span className="text-blue-400">{k}</span>
                                  <span className="text-gray-500">: </span>
                                  <span className="text-gray-400">{v}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {ep.response && (
                          <div>
                            <div className="text-sm font-medium text-gray-300 mb-2">Response</div>
                            <pre className="bg-slate-900 rounded p-3 text-sm font-mono text-green-400 overflow-x-auto">
                              {ep.response}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
