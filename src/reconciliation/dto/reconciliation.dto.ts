import { ApiProperty } from '@nestjs/swagger';
import { ReconciliationStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class MatchTransactionsDto {
  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab' })
  @IsUUID()
  manualTransactionId!: string;

  @ApiProperty({ example: '54f6a970-7271-4c1c-a15e-ac5605d0342f' })
  @IsUUID()
  smsTransactionId!: string;

  @ApiProperty({
    example: 'Same payment entered manually before SMS arrived.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class UpdateReconciliationStatusDto {
  @ApiProperty({
    enum: ReconciliationStatus,
    example: ReconciliationStatus.VERIFIED,
  })
  @IsEnum(ReconciliationStatus)
  status!: ReconciliationStatus;

  @ApiProperty({ example: 'User verified the transaction.', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
