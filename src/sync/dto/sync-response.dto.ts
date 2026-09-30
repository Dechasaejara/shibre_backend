import { ApiProperty } from '@nestjs/swagger';
import { TransactionResponseDto } from '../../transactions/dto/transaction-response.dto';

export class SyncPushResponseDto {
  @ApiProperty({ example: 3 })
  accepted!: number;

  @ApiProperty({ example: 0 })
  failed!: number;

  @ApiProperty({ type: [TransactionResponseDto] })
  transactions!: TransactionResponseDto[];

  @ApiProperty({ type: () => [SyncPushItemResultDto] })
  results!: SyncPushItemResultDto[];
}

export class SyncPushItemResultDto {
  @ApiProperty({ example: 'manualTransaction' })
  itemType!: string;

  @ApiProperty({ example: 'manual-local-id-1', nullable: true })
  localId!: string | null;

  @ApiProperty({ example: true })
  accepted!: boolean;

  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab', nullable: true })
  transactionId!: string | null;

  @ApiProperty({ example: 'Local ID is required for sync', nullable: true })
  error!: string | null;
}

export class SyncPullResponseDto {
  @ApiProperty({ example: '2026-09-25T12:00:00.000Z' })
  serverTime!: string;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z', nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ type: [TransactionResponseDto] })
  transactions!: TransactionResponseDto[];

  @ApiProperty({ example: false })
  hasMore!: boolean;
}

export class SyncStatusResponseDto {
  @ApiProperty({ example: '2026-09-25T12:00:00.000Z' })
  serverTime!: string;

  @ApiProperty({ example: true })
  ready!: boolean;
}
