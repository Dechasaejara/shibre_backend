import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  newTransactionEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  balanceMismatchEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  spendingLimitEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  upcomingBillEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  syncFailureEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  paymentStatusEnabled?: boolean;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty()
  newTransactionEnabled!: boolean;

  @ApiProperty()
  balanceMismatchEnabled!: boolean;

  @ApiProperty()
  spendingLimitEnabled!: boolean;

  @ApiProperty()
  upcomingBillEnabled!: boolean;

  @ApiProperty()
  syncFailureEnabled!: boolean;

  @ApiProperty()
  paymentStatusEnabled!: boolean;
}