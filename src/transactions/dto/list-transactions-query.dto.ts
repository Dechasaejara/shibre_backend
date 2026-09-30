import { ApiProperty } from '@nestjs/swagger';
import { TransactionSource, TransactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListTransactionsQueryDto {
  @ApiProperty({ example: 30, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({
    example: '408f9641-6052-4f9f-8226-3cb950678cab',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiProperty({ enum: TransactionType, required: false })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({ enum: TransactionSource, required: false })
  @IsOptional()
  @IsEnum(TransactionSource)
  source?: TransactionSource;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z', required: false })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z', required: false })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiProperty({ example: 'enat_bank', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  providerCode?: string;

  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab', required: false })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
