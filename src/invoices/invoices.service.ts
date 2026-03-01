import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Invoice, InvoiceStatus } from '../database/entities/invoice.entity';
import { Project } from '../database/entities/project.entity';
import { WalletsService } from '../wallets/wallets.service';
import { ProjectsService } from '../projects/projects.service';

interface CreateInvoiceDto {
  chainId: number;
  amount: string;
  callbackUrl?: string;
  externalId?: string;
  description?: string;
  expiresIn?: number; // in seconds
}

interface CreateInvoiceLegacyDto {
  projectId: number;
  chainId: number;
  amount: string;
  callbackUrl?: string;
  externalId?: string;
  description?: string;
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectQueue('invoice-processing')
    private readonly invoiceQueue: Queue,
    private readonly walletsService: WalletsService,
    private readonly projectsService: ProjectsService,
  ) {}

  async createInvoice(userId: number, projectId: number, dto: CreateInvoiceDto): Promise<Invoice> {
    // Validate project ownership
    await this.projectsService.validateOwnership(userId, projectId);

    // Generate sub-wallet for this invoice
    const subWallet = await this.walletsService.generateSubWallet(
      userId,
      projectId,
      dto.chainId,
    );

    // Set expiration (default 24 hours, or custom duration)
    const expiredAt = new Date();
    const expirationSeconds = dto.expiresIn || (24 * 60 * 60); // default 24 hours in seconds
    expiredAt.setSeconds(expiredAt.getSeconds() + expirationSeconds);

    const invoice = this.invoiceRepository.create({
      project_id: projectId,
      sub_wallet_id: subWallet.id,
      chain_id: dto.chainId,
      amount: dto.amount,
      callback_url: dto.callbackUrl,
      external_id: dto.externalId,
      description: dto.description,
      expired_at: expiredAt,
    });

    const saved = await this.invoiceRepository.save(invoice);

    // Queue expiration check
    await this.invoiceQueue.add(
      'check-expiration',
      { invoiceId: saved.id },
      { delay: 24 * 60 * 60 * 1000 }, // 24 hours
    );

    return this.findInvoice(userId, projectId, saved.id);
  }

  async findInvoice(userId: number, projectId: number, id: number): Promise<Invoice> {
    // Validate project ownership
    await this.projectsService.validateOwnership(userId, projectId);

    const invoice = await this.invoiceRepository.findOne({
      where: { id, project_id: projectId },
      relations: ['project', 'sub_wallet', 'chain'],
    });
    
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    
    return invoice;
  }

  async findInvoiceByExternalId(userId: number, projectId: number, externalId: string): Promise<Invoice> {
    // Validate project ownership
    await this.projectsService.validateOwnership(userId, projectId);

    const invoice = await this.invoiceRepository.findOne({
      where: { project_id: projectId, external_id: externalId },
      relations: ['project', 'sub_wallet', 'chain'],
    });
    
    if (!invoice) {
      throw new NotFoundException(`Invoice with external ID ${externalId} not found`);
    }
    
    return invoice;
  }

  async findProjectInvoices(userId: number, projectId: number): Promise<Invoice[]> {
    // Validate project ownership
    await this.projectsService.validateOwnership(userId, projectId);

    return this.invoiceRepository.find({
      where: { project_id: projectId },
      relations: ['sub_wallet', 'chain'],
      order: { created_at: 'DESC' },
    });
  }

  async cancelInvoice(userId: number, projectId: number, id: number): Promise<Invoice> {
    // Validate project ownership and get invoice
    const invoice = await this.findInvoice(userId, projectId, id);

    await this.invoiceRepository.update(id, {
      status: InvoiceStatus.CANCELLED,
    });

    return this.findInvoice(userId, projectId, id);
  }

  async getPaymentAddress(userId: number, projectId: number, invoiceId: number): Promise<string> {
    const invoice = await this.findInvoice(userId, projectId, invoiceId);
    return invoice.sub_wallet.address;
  }

  // Legacy methods for API key access
  async createInvoiceLegacy(dto: CreateInvoiceLegacyDto, project: Project): Promise<Invoice> {
    if (!project || project.id !== dto.projectId) {
      throw new NotFoundException('Project not found or access denied');
    }

    // Generate sub-wallet for this invoice  
    const subWallet = await this.walletsService.generateSubWalletLegacy(
      dto.chainId,
      dto.projectId,
      undefined,
      project,
    );

    // Set expiration (24 hours from now)
    const expiredAt = new Date();
    expiredAt.setHours(expiredAt.getHours() + 24);

    const invoice = this.invoiceRepository.create({
      project_id: dto.projectId,
      sub_wallet_id: subWallet.id,
      chain_id: dto.chainId,
      amount: dto.amount,
      callback_url: dto.callbackUrl,
      external_id: dto.externalId,
      description: dto.description,
      expired_at: expiredAt,
    });

    const saved = await this.invoiceRepository.save(invoice);

    // Queue expiration check
    await this.invoiceQueue.add(
      'check-expiration',
      { invoiceId: saved.id },
      { delay: 24 * 60 * 60 * 1000 }, // 24 hours
    );

    return this.findInvoiceLegacy(saved.id, project);
  }

  async findInvoiceLegacy(id: number, project: Project): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id, project_id: project.id },
      relations: ['project', 'sub_wallet', 'chain'],
    });
    
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    
    return invoice;
  }

  // Internal methods for system use
  async markInvoiceAsPaid(id: number): Promise<Invoice> {
    await this.invoiceRepository.update(id, {
      status: InvoiceStatus.PAID,
      paid_at: new Date(),
    });

    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['project', 'sub_wallet', 'chain'],
    });
    
    // Queue webhook notification
    await this.invoiceQueue.add('webhook-notification', {
      invoiceId: id,
      status: InvoiceStatus.PAID,
    });

    return invoice;
  }

  async markInvoiceAsExpired(id: number): Promise<Invoice> {
    await this.invoiceRepository.update(id, {
      status: InvoiceStatus.EXPIRED,
    });

    return this.invoiceRepository.findOne({
      where: { id },
      relations: ['project', 'sub_wallet', 'chain'],
    });
  }

  // Public method (no authentication required)
  async findPublicInvoice(id: number): Promise<{
    id: number;
    amount: string;
    status: string;
    description?: string;
    chain: { id: number; name: string; symbol: string };
    paymentAddress: string;
    expiredAt: string;
    createdAt: string;
    merchant: {
      name: string;
      logoUrl: string | null;
      address: string | null;
      email: string | null;
      phone: string | null;
    };
  }> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['sub_wallet', 'chain', 'project'],
    });
    
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    
    // Return only non-sensitive public information
    return {
      id: invoice.id,
      amount: invoice.amount,
      status: invoice.status,
      description: invoice.description,
      chain: {
        id: invoice.chain.id,
        name: invoice.chain.name,
        symbol: invoice.chain.gas_token,
      },
      paymentAddress: invoice.sub_wallet.address,
      expiredAt: invoice.expired_at.toISOString(),
      createdAt: invoice.created_at.toISOString(),
      // NEW: Project branding
      merchant: {
        name: invoice.project.business_name || invoice.project.name,
        logoUrl: invoice.project.logo_url || null,
        address: invoice.project.business_address || null,
        email: invoice.project.contact_email || null,
        phone: invoice.project.contact_phone || null,
      },
    };
  }
}