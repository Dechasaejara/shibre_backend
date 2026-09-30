import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class AnalyticsQueryDto {
  @ApiProperty({ example: '2026-09-01T00:00:00.000Z', required: false })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiProperty({ example: '2026-09-30T23:59:59.999Z', required: false })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
