import { ApiProperty } from '@nestjs/swagger';

export class ReconciliationTransactionSummaryDto {
  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab' })
  id!: string;

  @ApiProperty({ example: '250.00' })
  amount!: string;

  @ApiProperty({ example: 'MERCHANT_PAY' })
  type!: string;

  @ApiProperty({ example: 'OUTFLOW' })
  direction!: string;

  @ApiProperty({ example: 'MANUAL' })
  source!: string;

  @ApiProperty({ example: 'Shop ABC', nullable: true })
  counterpartyName!: string | null;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z', nullable: true })
  occurredAt!: string | null;
}

export class ReconciliationSuggestionDto {
  @ApiProperty({ type: ReconciliationTransactionSummaryDto })
  manualTransaction!: ReconciliationTransactionSummaryDto;

  @ApiProperty({ type: ReconciliationTransactionSummaryDto })
  smsTransaction!: ReconciliationTransactionSummaryDto;

  @ApiProperty({ example: 92 })
  score!: number;

  @ApiProperty({ example: ['amount', 'type', 'direction', 'dateProximity'] })
  reasons!: string[];
}

export class ReconciliationSuggestionsResponseDto {
  @ApiProperty({ type: [ReconciliationSuggestionDto] })
  suggestions!: ReconciliationSuggestionDto[];
}

export class ReconciliationActionResponseDto {
  @ApiProperty({ example: true })
  updated!: boolean;
}
