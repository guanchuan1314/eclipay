import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { SubWallet } from './sub-wallet.entity';
import { Invoice } from './invoice.entity';
import { Transaction } from './transaction.entity';
import { MasterWallet } from './master-wallet.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  api_key_hash: string;

  @Column({ nullable: true })
  webhook_url: string;

  @Column({ default: true })
  active: boolean;

  @Column({ default: 'testnet' })
  environment: string; // 'testnet' | 'mainnet'

  @Column({ nullable: true })
  logo_url: string;  // URL to logo image

  @Column({ nullable: true })
  business_name: string;  // Display name on invoices

  @Column({ nullable: true, type: 'text' })
  business_address: string;  // Business address

  @Column({ nullable: true })
  contact_email: string;  // Contact email

  @Column({ nullable: true })
  contact_phone: string;  // Contact phone

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, user => user.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => MasterWallet, wallet => wallet.project)
  master_wallets: MasterWallet[];

  @OneToMany(() => SubWallet, wallet => wallet.project)
  sub_wallets: SubWallet[];

  @OneToMany(() => Invoice, invoice => invoice.project)
  invoices: Invoice[];

  @OneToMany(() => Transaction, transaction => transaction.project)
  transactions: Transaction[];
}