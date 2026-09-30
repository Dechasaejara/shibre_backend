import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMerchantDto {
  @ApiProperty({ example: 'Ethio Telecom' })
  @IsString()
  @MaxLength(160)
  displayName!: string;

  @ApiProperty({ example: 'telebirr', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  providerCode?: string | null;

  @ApiProperty({ example: '933913041', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  merchantRef?: string | null;
}

export class UpdateMerchantDto extends PartialType(CreateMerchantDto) {
  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
