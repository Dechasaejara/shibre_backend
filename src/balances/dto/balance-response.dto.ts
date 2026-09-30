import { ApiProperty } from '@nestjs/swagger';

export class BalanceSnapshotResponseDto {
  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab' })
  id!: string;

  @ApiProperty({ example: '1500.00' })
  balance!: string;

  @ApiProperty({ example: 'telebirr', nullable: true })
  providerCode!: string | null;

  @ApiProperty({ example: 'Telebirr', nullable: true })
  providerName!: string | null;

  @ApiProperty({
    example: '408f9641-6052-4f9f-8226-3cb950678cab',
    nullable: true,
  })
  accountId!: string | null;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z' })
  recordedAt!: string;
}

export class BalanceDiscrepancyResponseDto {
  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab' })
  id!: string;

  @ApiProperty({ example: 'telebirr', nullable: true })
  providerCode!: string | null;

  @ApiProperty({ example: 'Telebirr', nullable: true })
  providerName!: string | null;

  @ApiProperty({
    example: '408f9641-6052-4f9f-8226-3cb950678cab',
    nullable: true,
  })
  transactionId!: string | null;

  @ApiProperty({ example: '1500.00' })
  reportedBalance!: string;

  @ApiProperty({ example: '1490.00' })
  expectedBalance!: string;

  @ApiProperty({ example: '10.00' })
  difference!: string;

  @ApiProperty({ example: 'OPEN' })
  status!: string;

  @ApiProperty({
    example: 'Reported balance differs from expected balance',
    nullable: true,
  })
  reason!: string | null;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z' })
  createdAt!: string;
}
