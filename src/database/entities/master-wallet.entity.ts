import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Chain } from './chain.entity';
import { SubWallet } from './sub-wallet.entity';
import { Project } from './project.entity';

@Entity('master_wallets')
export class MasterWallet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  chain_id: number;

  @Column()
  project_id: number;

  @Column()
  address: string;

  @Column()
  encrypted_private_key: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Chain, chain => chain.master_wallets)
  @JoinColumn({ name: 'chain_id' })
  chain: Chain;

  @ManyToOne(() => Project, project => project.master_wallets)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @OneToMany(() => SubWallet, wallet => wallet.master_wallet)
  sub_wallets: SubWallet[];
}