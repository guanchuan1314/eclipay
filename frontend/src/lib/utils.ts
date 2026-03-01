import { format, formatDistanceToNow } from 'date-fns';

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(amount: string | number, currency = 'USDT'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} ${currency}`;
}

export function formatAddress(address: string, length = 8): string {
  if (address.length <= length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMM d, yyyy HH:mm');
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function getChainIcon(chainId: string | number): string {
  const icons: Record<string, string> = {
    '1': '🔹', ethereum: '🔹',
    '2': '🟡', bsc: '🟡', binance: '🟡',
    '3': '🟣', polygon: '🟣',
    '4': '🔷', arbitrum: '🔷',
    '5': '🔴', optimism: '🔴',
    '6': '🔺', avalanche: '🔺',
    '7': '💠', tron: '💠',
    '8': '🟢', solana: '🟢',
    '9': '💎', ton: '💎',
  };
  
  return icons[String(chainId).toLowerCase()] || '⚡';
}

export function getChainColor(chainId: string | number): string {
  const colors: Record<string, string> = {
    '1': 'text-blue-400', ethereum: 'text-blue-400',
    '2': 'text-yellow-400', bsc: 'text-yellow-400', binance: 'text-yellow-400',
    '3': 'text-purple-400', polygon: 'text-purple-400',
    '4': 'text-blue-300', arbitrum: 'text-blue-300',
    '5': 'text-red-400', optimism: 'text-red-400',
    '6': 'text-red-400', avalanche: 'text-red-400',
    '7': 'text-teal-400', tron: 'text-teal-400',
    '8': 'text-green-400', solana: 'text-green-400',
    '9': 'text-cyan-400', ton: 'text-cyan-400',
  };
  
  return colors[String(chainId).toLowerCase()] || 'text-gray-400';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'text-yellow-400',
    confirmed: 'text-green-400',
    paid: 'text-green-400',
    failed: 'text-red-400',
    expired: 'text-red-400',
    cancelled: 'text-gray-400',
    approved: 'text-green-400',
    rejected: 'text-red-400',
  };
  
  return colors[String(status || '').toLowerCase()] || 'text-gray-400';
}

export function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    pending: 'bg-yellow-900 text-yellow-300',
    confirmed: 'bg-green-900 text-green-300',
    paid: 'bg-green-900 text-green-300',
    failed: 'bg-red-900 text-red-300',
    expired: 'bg-red-900 text-red-300',
    cancelled: 'bg-gray-700 text-gray-300',
    approved: 'bg-green-900 text-green-300',
    rejected: 'bg-red-900 text-red-300',
  };
  
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
    classes[String(status || '').toLowerCase()] || 'bg-gray-700 text-gray-300'
  }`;
}

export function getExplorerTxUrl(chainName: string, txHash: string): string {
  const explorers: Record<string, string> = {
    'Ethereum Sepolia': `https://sepolia.etherscan.io/tx/${txHash}`,
    'BSC Testnet': `https://testnet.bscscan.com/tx/${txHash}`,
    'Polygon Amoy': `https://amoy.polygonscan.com/tx/${txHash}`,
    'Tron Nile': `https://nile.tronscan.org/#/transaction/${txHash}`,
    'Solana Devnet': `https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
    'Ethereum Mainnet': `https://etherscan.io/tx/${txHash}`,
    'BSC Mainnet': `https://bscscan.com/tx/${txHash}`,
    'Polygon Mainnet': `https://polygonscan.com/tx/${txHash}`,
    'Arbitrum': `https://arbiscan.io/tx/${txHash}`,
    'Optimism': `https://optimistic.etherscan.io/tx/${txHash}`,
    'Avalanche': `https://snowtrace.io/tx/${txHash}`,
    'Tron Mainnet': `https://tronscan.org/#/transaction/${txHash}`,
    'Solana Mainnet': `https://explorer.solana.com/tx/${txHash}`,
  };

  return explorers[chainName] || '#';
}