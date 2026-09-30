import { Injectable, NotFoundException } from '@nestjs/common';
import { Merchant, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMerchantDto, UpdateMerchantDto } from './dto/merchant.dto';
import { MerchantResponseDto } from './dto/merchant-response.dto';

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMerchants(filters: {
    providerCode?: string;
    search?: string;
  }): Promise<MerchantResponseDto[]> {
    const where: Prisma.MerchantWhereInput = {
      isActive: true,
      providerCode: filters.providerCode,
      displayName: filters.search
        ? { contains: filters.search, mode: 'insensitive' }
        : undefined,
    };
    const merchants = await this.prisma.merchant.findMany({
      orderBy: { displayName: 'asc' },
      where,
    });

    return merchants.map((merchant) => this.toResponse(merchant));
  }

  async createMerchant(
    user: AuthenticatedUser,
    dto: CreateMerchantDto,
  ): Promise<MerchantResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.create({
        data: {
          displayName: dto.displayName,
          merchantRef: dto.merchantRef,
          providerCode: dto.providerCode,
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'MERCHANT_CREATED',
          actorId: user.userId,
          targetId: merchant.id,
          targetType: 'Merchant',
          details: {
            create: [
              { key: 'displayName', value: merchant.displayName },
              { key: 'providerCode', value: merchant.providerCode ?? '' },
              { key: 'merchantRef', value: merchant.merchantRef ?? '' },
            ],
          },
        },
      });
      return this.toResponse(merchant);
    });
  }

  async updateMerchant(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateMerchantDto,
  ): Promise<MerchantResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.merchant.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException(`Merchant not found: ${id}`);

      const merchant = await tx.merchant.update({
        data: {
          displayName: dto.displayName,
          isActive: dto.isActive,
          merchantRef: dto.merchantRef,
          providerCode: dto.providerCode,
        },
        where: { id },
      });
      await tx.auditLog.create({
        data: {
          action: 'MERCHANT_UPDATED',
          actorId: user.userId,
          targetId: merchant.id,
          targetType: 'Merchant',
          details: {
            create: [
              { key: 'displayName.before', value: existing.displayName },
              { key: 'displayName.after', value: merchant.displayName },
              { key: 'providerCode.before', value: existing.providerCode ?? '' },
              { key: 'providerCode.after', value: merchant.providerCode ?? '' },
              { key: 'merchantRef.before', value: existing.merchantRef ?? '' },
              { key: 'merchantRef.after', value: merchant.merchantRef ?? '' },
              { key: 'isActive.before', value: String(existing.isActive) },
              { key: 'isActive.after', value: String(merchant.isActive) },
            ],
          },
        },
      });
      return this.toResponse(merchant);
    });
  }

  private toResponse(merchant: Merchant): MerchantResponseDto {
    return {
      displayName: merchant.displayName,
      id: merchant.id,
      isActive: merchant.isActive,
      merchantRef: merchant.merchantRef,
      providerCode: merchant.providerCode,
    };
  }
}
