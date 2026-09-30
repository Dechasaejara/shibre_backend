import { ApiProperty } from '@nestjs/swagger';

export class ProviderSummaryResponseDto {
  @ApiProperty({ example: 'telebirr' })
  code!: string;

  @ApiProperty({ example: 'Telebirr' })
  displayName!: string;

  @ApiProperty({ example: 'ET' })
  countryCode!: string;

  @ApiProperty({ example: 'ETB' })
  currency!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;
}
