import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: 'Telebirr Wallet' })
  @IsString()
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ example: 'ETB', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiProperty({ example: 'telebirr', required: false })
  @IsOptional()
  @IsString()
  providerCode?: string;
}
