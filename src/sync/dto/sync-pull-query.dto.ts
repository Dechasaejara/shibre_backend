import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SyncPullQueryDto {
  @ApiProperty({ example: '2026-09-25T12:00:00.000Z', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiProperty({ example: 100, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
