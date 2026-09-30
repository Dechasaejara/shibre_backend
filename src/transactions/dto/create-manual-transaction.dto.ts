import { ApiProperty } from '@nestjs/swagger';
import { TransactionDirection, TransactionType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const amountPattern = /^\d{1,16}(\.\d{1,2})?$/;

export class CreateManualTransactionDto {
  @ApiProperty({ example: 'manual-local-id-1', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  localId?: string;

  @ApiProperty({ example: '250.00' })
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

  @ApiProperty({
    example: '408f9641-6052-4f9f-8226-3cb950678cab',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiProperty({
    example: '408f9641-6052-4f9f-8226-3cb950678cab',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

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

  @ApiProperty({ example: 'Lunch payment', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z', required: false })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
