import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionResponseDto {
  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab' })
  id!: string;

  @ApiProperty({ example: 'Monthly internet' })
  name!: string;

  @ApiProperty({ example: 'INTERNET' })
  category!: string;

  @ApiProperty({ example: 'MONTHLY' })
  frequency!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: '250.00', nullable: true })
  amount!: string | null;

  @ApiProperty({ example: 'ETB' })
  currency!: string;

  @ApiProperty({ example: 'FREQ=MONTHLY', nullable: true })
  recurrenceRule!: string | null;

  @ApiProperty({ example: '2026-10-25T12:00:00.000Z', nullable: true })
  nextDueAt!: string | null;

  @ApiProperty({
    example: '408f9641-6052-4f9f-8226-3cb950678cab',
    nullable: true,
  })
  merchantId!: string | null;

  @ApiProperty({ example: 'Ethio Telecom', nullable: true })
  merchantName!: string | null;

  @ApiProperty({ example: '933913041', nullable: true })
  merchantRef!: string | null;

  @ApiProperty({ example: 'telebirr', nullable: true })
  providerCode!: string | null;
}
