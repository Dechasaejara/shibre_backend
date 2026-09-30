import { ApiProperty } from '@nestjs/swagger';

export class ParseSmsResponseDto {
  @ApiProperty({ example: true })
  matched!: boolean;

  @ApiProperty({ example: 'telebirr', nullable: true })
  providerCode!: string | null;

  @ApiProperty({ example: 'Telebirr', nullable: true })
  providerName!: string | null;

  @ApiProperty({ example: 'P2P_IN', nullable: true })
  transactionType!: string | null;

  @ApiProperty({ example: 'INFLOW', nullable: true })
  direction!: string | null;

  @ApiProperty({ example: '1200.00', nullable: true })
  amount!: string | null;

  @ApiProperty({ example: 'ETB' })
  currency!: string;

  @ApiProperty({ example: 'Abebe Kebede', nullable: true })
  counterpartyName!: string | null;

  @ApiProperty({ example: '2519****0000', nullable: true })
  counterpartyPhone!: string | null;

  @ApiProperty({ example: 'ABC123', nullable: true })
  reference!: string | null;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z', nullable: true })
  transactionAt!: string | null;

  @ApiProperty({ example: '2000.00', nullable: true })
  currentBalance!: string | null;

  @ApiProperty({ example: { channel: 'MB' } })
  additionalFields!: Record<string, string>;
}
