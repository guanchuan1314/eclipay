import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { MasterWallet } from './master-wallet.entity';
import { SubWallet } from './sub-wallet.entity';
import { Invoice } from './invoice.entity';
import { Transaction } from './transaction.entity';

@Entity('chains')
export class Chain {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column()
  standard: string; // EVM, TRON, SOLANA, TON

  @Column()
  gas_token: string; // ETH, TRX, SOL, TON

  @Column()
  rpc_url: string;

  @Column({ nullable: true })
  usdt_contract: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: false })
  is_testnet: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => MasterWallet, wallet => wallet.chain)
  master_wallets: MasterWallet[];

  @OneToMany(() => SubWallet, wallet => wallet.chain)
  sub_wallets: SubWallet[];

  @OneToMany(() => Invoice, invoice => invoice.chain)
  invoices: Invoice[];

  @OneToMany(() => Transaction, transaction => transaction.chain)
  transactions: Transaction[];
}