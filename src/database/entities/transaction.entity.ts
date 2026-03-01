import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Chain } from './chain.entity';
import { Project } from './project.entity';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal'
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed'
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  chain_id: number;

  @Column()
  tx_hash: string;

  @Column()
  from_address: string;

  @Column()
  to_address: string;

  @Column('decimal', { precision: 18, scale: 6 })
  amount: string;

  @Column({ default: 'USDT' })
  token: string;

  @Column({
    type: 'enum',
    enum: TransactionType
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING
  })
  status: TransactionStatus;

  @Column({ default: 0 })
  confirmations: number;

  @Column({ nullable: true })
  block_number: number;

  @Column({ nullable: true })
  invoice_id: number;

  @Column({ nullable: true })
  project_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Chain, chain => chain.transactions)
  @JoinColumn({ name: 'chain_id' })
  chain: Chain;

  @ManyToOne(() => Project, project => project.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
}