import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  SubscriptionCategory,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '@prisma/client';
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

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'Monthly internet' })
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty({
    enum: SubscriptionCategory,
    example: SubscriptionCategory.INTERNET,
    required: false,
  })
  @IsOptional()
  @IsEnum(SubscriptionCategory)
  category?: SubscriptionCategory;

  @ApiProperty({
    enum: SubscriptionFrequency,
    example: SubscriptionFrequency.MONTHLY,
    required: false,
  })
  @IsOptional()
  @IsEnum(SubscriptionFrequency)
  frequency?: SubscriptionFrequency;

  @ApiProperty({
    example: '408f9641-6052-4f9f-8226-3cb950678cab',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  merchantId?: string | null;

  @ApiProperty({ example: '250.00', required: false, nullable: true })
  @IsOptional()
  @Matches(amountPattern)
  amount?: string | null;

  @ApiProperty({ example: 'ETB', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiProperty({ example: 'FREQ=MONTHLY', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  recurrenceRule?: string;

  @ApiProperty({
    example: '2026-10-25T12:00:00.000Z',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsISO8601()
  nextDueAt?: string | null;
}

export class UpdateSubscriptionDto extends PartialType(CreateSubscriptionDto) {
  @ApiProperty({
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
    required: false,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}
