export interface Chain {
  id: number;
  name: string;
  standard: string;
  gasToken: string;
  rpcUrl: string;
  usdtContract: string;
  enabled: boolean;
  isTestnet: boolean;
}

export interface Wallet {
  id: number;
  chainId: number;
  masterWalletId: number;
  derivationIndex: number;
  address: string;
  projectId: number;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
  chain?: Chain;
}

export interface Transaction {
  id: number;
  chainId: number;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  status: string;
  type: string;
  createdAt: string;
}

export interface Invoice {
  id: number;
  projectId: number;
  subWalletId: number;
  chainId: number;
  amount: string;
  status: string;
  callbackUrl?: string;
  externalId?: string;
  createdAt: string;
  paidAt?: string;
  expiredAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  apiKey: string;
  webhookUrl?: string;
  userId: string;
  environment: 'testnet' | 'mainnet';
  logoUrl?: string;
  businessName?: string;
  businessAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

// Keep Merchant for backward compatibility but mark as deprecated
export interface Merchant {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  webhookUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalDeposits: string;
  totalWithdrawals: string;
  activeWallets: number;
  pendingTransactions: number;
  balanceByChain: Record<string, string>;
}