import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotificationPreferencesResponseDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification-preferences.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(
    user: AuthenticatedUser,
  ): Promise<NotificationPreferencesResponseDto> {
    const preferences = await this.prisma.notificationPreference.upsert({
      where: { userId: user.userId },
      create: { userId: user.userId },
      update: {},
    });
    return this.toResponse(preferences);
  }

  async updatePreferences(
    user: AuthenticatedUser,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesResponseDto> {
    const preferences = await this.prisma.notificationPreference.upsert({
      where: { userId: user.userId },
      create: { userId: user.userId, ...dto },
      update: dto,
    });
    return this.toResponse(preferences);
  }

  private toResponse(preferences: {
    newTransactionEnabled: boolean;
    balanceMismatchEnabled: boolean;
    spendingLimitEnabled: boolean;
    upcomingBillEnabled: boolean;
    syncFailureEnabled: boolean;
    paymentStatusEnabled: boolean;
  }): NotificationPreferencesResponseDto {
    return {
      newTransactionEnabled: preferences.newTransactionEnabled,
      balanceMismatchEnabled: preferences.balanceMismatchEnabled,
      spendingLimitEnabled: preferences.spendingLimitEnabled,
      upcomingBillEnabled: preferences.upcomingBillEnabled,
      syncFailureEnabled: preferences.syncFailureEnabled,
      paymentStatusEnabled: preferences.paymentStatusEnabled,
    };
  }
}