import { ApiProperty } from '@nestjs/swagger';

export class AnalyticsSummaryResponseDto {
  @ApiProperty({ example: '12500.00' })
  totalInflow!: string;

  @ApiProperty({ example: '8400.00' })
  totalOutflow!: string;

  @ApiProperty({ example: '4100.00' })
  netCashflow!: string;

  @ApiProperty({ example: 42 })
  transactionCount!: number;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  from!: string;

  @ApiProperty({ example: '2026-09-30T23:59:59.999Z' })
  to!: string;
}

export class CashflowPointDto {
  @ApiProperty({ example: '2026-09-25' })
  date!: string;

  @ApiProperty({ example: '1200.00' })
  inflow!: string;

  @ApiProperty({ example: '750.00' })
  outflow!: string;

  @ApiProperty({ example: '450.00' })
  net!: string;
}

export class AnalyticsCashflowResponseDto {
  @ApiProperty({ type: [CashflowPointDto] })
  points!: CashflowPointDto[];
}

export class AnalyticsBreakdownItemDto {
  @ApiProperty({ example: 'Merchant Payment' })
  label!: string;

  @ApiProperty({ example: 'merchant-payment', nullable: true })
  key!: string | null;

  @ApiProperty({ example: '1200.00' })
  inflow!: string;

  @ApiProperty({ example: '750.00' })
  outflow!: string;

  @ApiProperty({ example: '450.00' })
  net!: string;

  @ApiProperty({ example: 8 })
  transactionCount!: number;
}

export class AnalyticsBreakdownResponseDto {
  @ApiProperty({ type: [AnalyticsBreakdownItemDto] })
  items!: AnalyticsBreakdownItemDto[];
}
