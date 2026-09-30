import { ApiProperty } from '@nestjs/swagger';
import { TransactionDirection, TransactionType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const amountPattern = /^\d{1,16}(\.\d{1,2})?$/;

export class IngestSmsTransactionDto {
  @ApiProperty({ example: 'sms-local-id-1', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  localId?: string;

  @ApiProperty({ example: '127' })
  @IsString()
  @MaxLength(80)
  senderId!: string;

  @ApiProperty({
    example: 'You paid ETB 120.00 to merchant Shop ABC...',
    required: false,
  })
  @IsOptional()
  @IsString()
  messageBody?: string;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z' })
  @IsISO8601()
  receivedAt!: string;

  @ApiProperty({ example: '120.00' })
  @Matches(amountPattern)
  amount!: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.MERCHANT_PAY })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({
    enum: TransactionDirection,
    example: TransactionDirection.OUTFLOW,
  })
  @IsEnum(TransactionDirection)
  direction!: TransactionDirection;

  @ApiProperty({ example: 'ETB', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiProperty({ example: 'telebirr', required: false })
  @IsOptional()
  @IsString()
  providerCode?: string;

  @ApiProperty({ example: 'Shop ABC', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  counterpartyName?: string;

  @ApiProperty({ example: '+251911111111', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  counterpartyPhone?: string;

  @ApiProperty({ example: 'TB123456', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;

  @ApiProperty({ example: '1500.00', required: false })
  @IsOptional()
  @Matches(amountPattern)
  currentBalance?: string;
}
