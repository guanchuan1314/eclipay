import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Chain } from './chain.entity';
import { MasterWallet } from './master-wallet.entity';
import { Project } from './project.entity';
import { Invoice } from './invoice.entity';

@Entity('sub_wallets')
export class SubWallet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  chain_id: number;

  @Column()
  master_wallet_id: number;

  @Column()
  derivation_index: number;

  @Column()
  address: string;

  @Column()
  project_id: number;

  @Column({ default: false })
  approved: boolean;

  @Column({ type: 'enum', enum: ['payment', 'client'], default: 'payment' })
  type: 'payment' | 'client';

  @Column({ nullable: true })
  encrypted_private_key: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Chain, chain => chain.sub_wallets)
  @JoinColumn({ name: 'chain_id' })
  chain: Chain;

  @ManyToOne(() => MasterWallet, wallet => wallet.sub_wallets)
  @JoinColumn({ name: 'master_wallet_id' })
  master_wallet: MasterWallet;

  @ManyToOne(() => Project, project => project.sub_wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @OneToMany(() => Invoice, invoice => invoice.sub_wallet)
  invoices: Invoice[];
}