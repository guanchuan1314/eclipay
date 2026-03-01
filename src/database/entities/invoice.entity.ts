import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Project } from './project.entity';
import { SubWallet } from './sub-wallet.entity';
import { Chain } from './chain.entity';

export enum InvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  project_id: number;

  @Column()
  sub_wallet_id: number;

  @Column()
  chain_id: number;

  @Column('decimal', { precision: 18, scale: 6 })
  amount: string;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING
  })
  status: InvoiceStatus;

  @Column({ nullable: true })
  callback_url: string;

  @Column({ nullable: true })
  external_id: string;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  paid_at: Date;

  @Column({ nullable: true })
  expired_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Project, project => project.invoices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => SubWallet, wallet => wallet.invoices)
  @JoinColumn({ name: 'sub_wallet_id' })
  sub_wallet: SubWallet;

  @ManyToOne(() => Chain, chain => chain.invoices)
  @JoinColumn({ name: 'chain_id' })
  chain: Chain;
}