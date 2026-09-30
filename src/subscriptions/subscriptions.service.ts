import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
} from './dto/subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

type SubscriptionRecord = Prisma.SubscriptionGetPayload<{
  include: { merchant: true };
}>;

// Legacy recurrenceRule is kept in sync for older clients.
export const FREQUENCY_RULES: Record<SubscriptionFrequency, string> = {
  WEEKLY: 'FREQ=WEEKLY',
  MONTHLY: 'FREQ=MONTHLY',
  QUARTERLY: 'FREQ=MONTHLY;INTERVAL=3',
  YEARLY: 'FREQ=YEARLY',
};

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSubscriptions(
    user: AuthenticatedUser,
  ): Promise<SubscriptionResponseDto[]> {
    const subscriptions = await this.prisma.subscription.findMany({
      include: { merchant: true },
      orderBy: [{ status: 'asc' }, { nextDueAt: 'asc' }, { name: 'asc' }],
      where: { userId: user.userId },
    });

    return subscriptions.map((subscription) => this.toResponse(subscription));
  }

  async createSubscription(
    user: AuthenticatedUser,
    dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const frequency = dto.frequency ?? SubscriptionFrequency.MONTHLY;
    const subscription = await this.prisma.subscription.create({
      data: {
        amount: dto.amount,
        category: dto.category,
        currency: dto.currency ?? 'ETB',
        frequency,
        merchantId: dto.merchantId,
        name: dto.name,
        nextDueAt: dto.nextDueAt ? new Date(dto.nextDueAt) : undefined,
        recurrenceRule: FREQUENCY_RULES[frequency],
        status: SubscriptionStatus.ACTIVE,
        userId: user.userId,
      },
      include: { merchant: true },
    });

    return this.toResponse(subscription);
  }

  async updateSubscription(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const existing = await this.prisma.subscription.findFirst({
      where: { id, userId: user.userId },
    });

    if (!existing) {
      throw new NotFoundException(`Subscription not found: ${id}`);
    }

    const subscription = await this.prisma.subscription.update({
      data: {
        amount: dto.amount,
        category: dto.category,
        currency: dto.currency,
        frequency: dto.frequency,
        merchantId: dto.merchantId,
        name: dto.name,
        nextDueAt:
          dto.nextDueAt === null
            ? null
            : dto.nextDueAt
              ? new Date(dto.nextDueAt)
              : undefined,
        recurrenceRule: dto.frequency
          ? FREQUENCY_RULES[dto.frequency]
          : dto.recurrenceRule,
        status: dto.status,
      },
      include: { merchant: true },
      where: { id },
    });

    return this.toResponse(subscription);
  }

  private toResponse(
    subscription: SubscriptionRecord,
  ): SubscriptionResponseDto {
    return {
      amount: subscription.amount?.toFixed(2) ?? null,
      category: subscription.category,
      currency: subscription.currency,
      frequency: subscription.frequency,
      id: subscription.id,
      merchantId: subscription.merchantId,
      merchantName: subscription.merchant?.displayName ?? null,
      merchantRef: subscription.merchant?.merchantRef ?? null,
      name: subscription.name,
      nextDueAt: subscription.nextDueAt?.toISOString() ?? null,
      providerCode: subscription.merchant?.providerCode ?? null,
      recurrenceRule: subscription.recurrenceRule,
      status: subscription.status,
    };
  }
}
