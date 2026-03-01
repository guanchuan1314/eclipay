export interface ChainWallet {
  address: string;
  privateKey: string;
}

export interface ChainTransaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  confirmations: number;
  blockNumber?: number;
  timestamp?: number;
}

export interface ChainBalance {
  address: string;
  balance: string;
  decimals: number;
}

export abstract class ChainInterface {
  abstract readonly name: string;
  abstract readonly standard: string;
  abstract readonly gasToken: string;
  abstract readonly usdtContract?: string;

  // Wallet operations
  abstract generateWallet(): Promise<ChainWallet>;
  abstract deriveWallet(masterSeed: string, index: number): Promise<ChainWallet>;
  abstract validateAddress(address: string): boolean;

  // Balance operations
  abstract getUSDTBalance(address: string): Promise<ChainBalance>;
  abstract getNativeBalance(address: string): Promise<ChainBalance>;

  // Transaction operations
  abstract sendUSDT(from: ChainWallet, to: string, amount: string): Promise<string>;
  abstract sendNative?(from: ChainWallet, to: string, amount: string): Promise<string>;
  abstract getTransaction(txHash: string): Promise<ChainTransaction>;
  abstract monitorAddress(address: string, callback: (tx: ChainTransaction) => void): void;

  // Utility
  abstract estimateGasFee(): Promise<string>;
  abstract getCurrentBlock(): Promise<number>;

  // Approve/Sweep functionality (EVM chains)
  abstract fundSubWalletGas?(masterWallet: ChainWallet, subWalletAddress: string, amount?: string): Promise<string>;
  abstract approveSubWallet?(subWalletPrivateKey: string, masterWalletAddress: string): Promise<string>;
  abstract sweepSubWallet?(
    masterWalletPrivateKey: string, 
    subWalletAddress: string, 
    masterWalletAddress: string, 
    amount: string
  ): Promise<string>;
}