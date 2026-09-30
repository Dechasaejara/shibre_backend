import { ApiProperty } from '@nestjs/swagger';

export class TransactionResponseDto {
  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab' })
  id!: string;

  @ApiProperty({ example: 'manual-local-id-1', nullable: true })
  localId!: string | null;

  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab', nullable: true })
  accountId!: string | null;

  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab', nullable: true })
  categoryId!: string | null;

  @ApiProperty({ example: '250.00' })
  amount!: string;

  @ApiProperty({ example: 'ETB' })
  currency!: string;

  @ApiProperty({ example: 'MERCHANT_PAY' })
  type!: string;

  @ApiProperty({ example: 'OUTFLOW' })
  direction!: string;

  @ApiProperty({ example: 'SMS' })
  source!: string;

  @ApiProperty({ example: 'UNRECONCILED' })
  reconciliationStatus!: string;

  @ApiProperty({ example: 'PENDING' })
  syncStatus!: string;

  @ApiProperty({ example: 'telebirr', nullable: true })
  providerCode!: string | null;

  @ApiProperty({ example: 'Telebirr', nullable: true })
  providerName!: string | null;

  @ApiProperty({ example: 'Shop ABC', nullable: true })
  counterpartyName!: string | null;

  @ApiProperty({ example: '+251911111111', nullable: true })
  counterpartyPhone!: string | null;

  @ApiProperty({ example: 'TB123456', nullable: true })
  reference!: string | null;

  @ApiProperty({ example: 'Lunch payment', nullable: true })
  note!: string | null;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z', nullable: true })
  occurredAt!: string | null;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z' })
  updatedAt!: string;
}

export class TransactionListResponseDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  items!: TransactionResponseDto[];

  @ApiProperty({
    example: '408f9641-6052-4f9f-8226-3cb950678cab',
    nullable: true,
  })
  nextCursor!: string | null;
}
