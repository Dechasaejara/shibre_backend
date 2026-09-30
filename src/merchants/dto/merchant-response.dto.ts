import { ApiProperty } from '@nestjs/swagger';

export class MerchantResponseDto {
  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab' })
  id!: string;

  @ApiProperty({ example: 'Ethio Telecom' })
  displayName!: string;

  @ApiProperty({ example: 'telebirr', nullable: true })
  providerCode!: string | null;

  @ApiProperty({ example: '933913041', nullable: true })
  merchantRef!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;
}
