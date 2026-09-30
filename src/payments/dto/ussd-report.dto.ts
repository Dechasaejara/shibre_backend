import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UssdReportReason, UssdReportStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateUssdReportDto {
  @ApiProperty({ example: 'telebirr' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  providerCode!: string;

  @ApiProperty({ example: 'MERCHANT_PAY' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  paymentType!: string;

  @ApiProperty({ enum: UssdReportReason, example: UssdReportReason.WRONG_MENU })
  @IsEnum(UssdReportReason)
  reason!: UssdReportReason;

  @ApiPropertyOptional({ example: 'The dialer opened but the menu asked for a different option.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ example: 'android' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}

export class UssdReportResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: UssdReportStatus })
  status!: UssdReportStatus;

  @ApiProperty()
  createdAt!: string;
}
