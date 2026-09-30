import { ApiProperty } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class IngestRawSmsDto {
  @ApiProperty({ example: 'sms-local-id-1', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  localId?: string;

  @ApiProperty({ example: '127' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  senderId!: string;

  @ApiProperty({ example: 'Dear Customer You have received ETB 1,200.00...' })
  @IsString()
  @IsNotEmpty()
  messageBody!: string;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z', required: false })
  @IsOptional()
  @IsISO8601()
  receivedAt?: string;
}
