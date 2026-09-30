import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountResponseDto } from './dto/account-response.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

type AccountRecord = Prisma.AccountGetPayload<{
  include: {
    balanceSnapshots: true;
    provider: true;
  };
}>;

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts(user: AuthenticatedUser): Promise<AccountResponseDto[]> {
    const accounts = await this.prisma.account.findMany({
      include: {
        balanceSnapshots: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
        provider: true,
      },
      orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
      where: { userId: user.userId },
    });

    return accounts.map((account) => this.toResponse(account));
  }

  async createAccount(
    user: AuthenticatedUser,
    dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    const provider = dto.providerCode
      ? await this.prisma.provider.findUnique({
          where: { code: dto.providerCode },
        })
      : null;
    const account = await this.prisma.account.create({
      data: {
        currency: dto.currency ?? provider?.currency ?? 'ETB',
        displayName: dto.displayName,
        providerId: provider?.id,
        userId: user.userId,
      },
      include: {
        balanceSnapshots: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
        provider: true,
      },
    });

    return this.toResponse(account);
  }

  async updateAccount(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    const existing = await this.prisma.account.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) {
      throw new NotFoundException(`Account not found: ${id}`);
    }

    const account = await this.prisma.account.update({
      data: {
        displayName: dto.displayName,
        isActive: dto.isActive,
      },
      include: {
        balanceSnapshots: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
        provider: true,
      },
      where: { id },
    });

    return this.toResponse(account);
  }

  private toResponse(account: AccountRecord): AccountResponseDto {
    return {
      currency: account.currency,
      displayName: account.displayName,
      id: account.id,
      isActive: account.isActive,
      latestBalance: account.balanceSnapshots[0]?.balance.toFixed(2) ?? null,
      providerCode: account.provider?.code ?? null,
      providerName: account.provider?.displayName ?? null,
    };
  }
}
