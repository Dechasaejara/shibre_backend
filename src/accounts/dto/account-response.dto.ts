import { ApiProperty } from '@nestjs/swagger';

export class AccountResponseDto {
  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab' })
  id!: string;

  @ApiProperty({ example: 'Telebirr Wallet' })
  displayName!: string;

  @ApiProperty({ example: 'ETB' })
  currency!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 'telebirr', nullable: true })
  providerCode!: string | null;

  @ApiProperty({ example: 'Telebirr', nullable: true })
  providerName!: string | null;

  @ApiProperty({ example: '1500.00', nullable: true })
  latestBalance!: string | null;
}
