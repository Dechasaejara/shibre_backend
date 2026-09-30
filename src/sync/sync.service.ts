import { BadRequestException, HttpException, Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.service';
import { shortId } from '../common/logging';
import { TransactionResponseDto } from '../transactions/dto/transaction-response.dto';
import { TransactionsService } from '../transactions/transactions.service';
import { SyncPullQueryDto } from './dto/sync-pull-query.dto';
import { SyncPushDto } from './dto/sync-push.dto';
import {
  SyncPullResponseDto,
  SyncPushItemResultDto,
  SyncPushResponseDto,
  SyncStatusResponseDto,
} from './dto/sync-response.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly transactionsService: TransactionsService) {}

  async push(
    user: AuthenticatedUser,
    dto: SyncPushDto,
  ): Promise<SyncPushResponseDto> {
    const transactions: TransactionResponseDto[] = [];
    const results: SyncPushItemResultDto[] = [];

    for (const manualTransaction of dto.manualTransactions ?? []) {
      await this.pushItem(
        'manualTransaction',
        manualTransaction.localId,
        () =>
          this.transactionsService.createManualTransaction(
            user,
            manualTransaction,
          ),
        results,
        transactions,
      );
    }

    for (const smsTransaction of dto.smsTransactions ?? []) {
      await this.pushItem(
        'smsTransaction',
        smsTransaction.localId,
        () =>
          this.transactionsService.ingestSmsTransaction(user, smsTransaction),
        results,
        transactions,
      );
    }

    for (const rawSmsMessage of dto.rawSmsMessages ?? []) {
      await this.pushItem(
        'rawSms',
        rawSmsMessage.localId,
        () => this.transactionsService.ingestRawSms(user, rawSmsMessage),
        results,
        transactions,
      );
    }

    const accepted = results.filter((result) => result.accepted).length;
    const failed = results.length - accepted;
    const summary = `Sync push user=${shortId(user.userId)} device=${shortId(user.deviceId)} manual=${dto.manualTransactions?.length ?? 0} sms=${dto.smsTransactions?.length ?? 0} raw=${dto.rawSmsMessages?.length ?? 0} accepted=${accepted} failed=${failed}`;
    if (failed > 0) this.logger.warn(summary);
    else if (results.length > 0) this.logger.log(summary);
    else this.logger.debug(summary);

    return {
      accepted,
      failed,
      results,
      transactions,
    };
  }

  async pull(
    user: AuthenticatedUser,
    query: SyncPullQueryDto,
  ): Promise<SyncPullResponseDto> {
    const limit = query.limit ?? 100;
    const cursor = this.decodeCursor(query.cursor);
    const page = await this.transactionsService.findUpdatedTransactions(
      user,
      cursor,
      limit,
    );

    return {
      hasMore: page.hasMore,
      nextCursor:
        page.hasMore && page.nextPosition
          ? this.encodeCursor({
              afterId: page.nextPosition.id,
              afterUpdatedAt: page.nextPosition.updatedAt,
              snapshotAt: cursor.snapshotAt.toISOString(),
            })
          : this.encodeCursor({
              checkpoint: true,
              snapshotAt: cursor.snapshotAt.toISOString(),
            }),
      serverTime: cursor.snapshotAt.toISOString(),
      transactions: page.items,
    };
  }

  status(): SyncStatusResponseDto {
    return {
      ready: true,
      serverTime: new Date().toISOString(),
    };
  }

  private async pushItem(
    itemType: SyncPushItemResultDto['itemType'],
    itemLocalId: string | undefined,
    createTransaction: () => Promise<TransactionResponseDto>,
    results: SyncPushItemResultDto[],
    transactions: TransactionResponseDto[],
  ): Promise<void> {
    const localId = itemLocalId?.trim() || null;
    if (!localId) {
      results.push({
        accepted: false,
        error: 'localId is required for retry-safe sync',
        itemType,
        localId,
        transactionId: null,
      });
      return;
    }

    try {
      const transaction = await createTransaction();

      this.logger.debug(`Sync ${itemType} accepted localId=${localId} tx=${shortId(transaction.id)} provider=${transaction.providerCode ?? '-'}`);
      transactions.push(transaction);
      results.push({
        accepted: true,
        error: null,
        itemType,
        localId,
        transactionId: transaction.id,
      });
    } catch (error: unknown) {
      const message = this.safeErrorMessage(error);
      if (error instanceof HttpException) this.logger.warn(`Sync ${itemType} rejected localId=${localId}: ${message}`);
      else this.logger.error(`Sync ${itemType} crashed localId=${localId}`, error instanceof Error ? error.stack : String(error));
      results.push({
        accepted: false,
        error: message,
        itemType,
        localId,
        transactionId: null,
      });
    }
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const message = response.message;
        return Array.isArray(message) ? message.join('; ') : String(message);
      }
    }
    return 'Sync item failed; retry or review the local record';
  }

  private decodeCursor(cursor: string | undefined): {
    snapshotAt: Date;
    afterUpdatedAt?: Date;
    afterId?: string;
  } {
    if (!cursor) return { snapshotAt: new Date() };

    // Accept the previous ISO timestamp cursor once while upgrading clients.
    const legacyTimestamp = new Date(cursor);
    if (Number.isFinite(legacyTimestamp.getTime())) {
      return { afterUpdatedAt: legacyTimestamp, snapshotAt: new Date() };
    }

    try {
      const value: unknown = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      );
      if (
        typeof value === 'object' &&
        value !== null &&
        'snapshotAt' in value &&
        typeof value.snapshotAt === 'string'
      ) {
        const snapshotAt = new Date(value.snapshotAt);
        if (!Number.isFinite(snapshotAt.getTime())) {
          throw new BadRequestException('Invalid sync cursor');
        }
        if ('checkpoint' in value && value.checkpoint === true) {
          return {
            afterId: '',
            afterUpdatedAt: snapshotAt,
            snapshotAt: new Date(),
          };
        }
        if (
          'afterUpdatedAt' in value &&
          typeof value.afterUpdatedAt === 'string' &&
          'afterId' in value &&
          typeof value.afterId === 'string'
        ) {
          const afterUpdatedAt = new Date(value.afterUpdatedAt);
          if (Number.isFinite(afterUpdatedAt.getTime())) {
            return { afterId: value.afterId, afterUpdatedAt, snapshotAt };
          }
        }
      }
    } catch {
      throw new BadRequestException('Invalid sync cursor');
    }

    throw new BadRequestException('Invalid sync cursor');
  }

  private encodeCursor(cursor: {
    checkpoint?: true;
    snapshotAt: string;
    afterUpdatedAt?: string;
    afterId?: string;
  }): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }
}
