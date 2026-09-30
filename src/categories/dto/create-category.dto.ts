import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Groceries' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'shopping-basket', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;

  @ApiProperty({ example: '#00A651', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;

  @ApiProperty({
    example: '408f9641-6052-4f9f-8226-3cb950678cab',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
