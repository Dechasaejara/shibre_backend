import { ApiProperty } from '@nestjs/swagger';
import { BalanceDiscrepancyStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDiscrepancyDto {
  @ApiProperty({
    enum: BalanceDiscrepancyStatus,
    example: BalanceDiscrepancyStatus.REVIEWED,
  })
  @IsEnum(BalanceDiscrepancyStatus)
  status!: BalanceDiscrepancyStatus;

  @ApiProperty({ example: 'Reviewed by user', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
