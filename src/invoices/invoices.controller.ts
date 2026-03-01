import { Controller, Get, Post, Param, Body, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { Invoice } from '../database/entities/invoice.entity';
import { JwtAuth } from '../auth/decorators/jwt-auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';

class CreateInvoiceDto {
  chainId: number;
  amount: string;
  callbackUrl?: string;
  externalId?: string;
  description?: string;
  expiresIn?: number; // in seconds
}

class CreateInvoiceLegacyDto {
  projectId: number;
  chainId: number;
  amount: string;
  callbackUrl?: string;
  externalId?: string;
  description?: string;
}

@ApiTags('invoices')
@Controller('projects/:projectId/invoices')
@JwtAuth()
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new invoice for project' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  async createInvoice(@Request() req, @Param('projectId') projectId: number, @Body() dto: CreateInvoiceDto): Promise<Invoice> {
    return this.invoicesService.createInvoice(req.user.id, projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get invoices for project' })
  @ApiResponse({ status: 200, description: 'List of invoices' })
  async getProjectInvoices(@Request() req, @Param('projectId') projectId: number): Promise<Invoice[]> {
    return this.invoicesService.findProjectInvoices(req.user.id, projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiResponse({ status: 200, description: 'Invoice details' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoice(@Request() req, @Param('projectId') projectId: number, @Param('id') id: number): Promise<Invoice> {
    return this.invoicesService.findInvoice(req.user.id, projectId, id);
  }

  @Get('external/:externalId')
  @ApiOperation({ summary: 'Get invoice by external ID' })
  @ApiResponse({ status: 200, description: 'Invoice details' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoiceByExternalId(
    @Request() req,
    @Param('projectId') projectId: number,
    @Param('externalId') externalId: string,
  ): Promise<Invoice> {
    return this.invoicesService.findInvoiceByExternalId(req.user.id, projectId, externalId);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel an invoice' })
  @ApiResponse({ status: 200, description: 'Invoice cancelled successfully' })
  async cancelInvoice(@Request() req, @Param('projectId') projectId: number, @Param('id') id: number): Promise<Invoice> {
    return this.invoicesService.cancelInvoice(req.user.id, projectId, id);
  }

  @Get(':id/payment-address')
  @ApiOperation({ summary: 'Get payment address for an invoice' })
  @ApiResponse({ status: 200, description: 'Payment address' })
  async getPaymentAddress(@Request() req, @Param('projectId') projectId: number, @Param('id') id: number): Promise<{ address: string }> {
    const address = await this.invoicesService.getPaymentAddress(req.user.id, projectId, id);
    return { address };
  }
}

// Legacy API key endpoints
@ApiTags('invoices')
@ApiSecurity('api-key')
@Controller('invoices')
export class LegacyInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new invoice (deprecated)' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  async createInvoice(@Body() dto: CreateInvoiceLegacyDto, @Request() req): Promise<Invoice> {
    return this.invoicesService.createInvoiceLegacy(dto, req.project);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID (deprecated)' })
  @ApiResponse({ status: 200, description: 'Invoice details' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoice(@Param('id') id: number, @Request() req): Promise<Invoice> {
    return this.invoicesService.findInvoiceLegacy(id, req.project);
  }
}

// Public endpoints (no authentication required)
@ApiTags('invoices-public')
@Controller('invoices')
export class PublicInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Public()
  @Get(':id/public')
  @ApiOperation({ summary: 'Get public invoice details for payment page' })
  @ApiResponse({ status: 200, description: 'Public invoice details' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getPublicInvoice(@Param('id') id: number): Promise<{
    id: number;
    amount: string;
    status: string;
    chain: { id: number; name: string; symbol: string };
    paymentAddress: string;
    expiredAt: string;
    createdAt: string;
  }> {
    return this.invoicesService.findPublicInvoice(id);
  }
}