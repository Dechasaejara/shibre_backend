import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab' })
  id!: string;

  @ApiProperty({ example: 'CUSTOM' })
  kind!: string;

  @ApiProperty({ example: 'Food' })
  name!: string;

  @ApiProperty({ example: 'utensils', nullable: true })
  icon!: string | null;

  @ApiProperty({ example: '#00A651', nullable: true })
  color!: string | null;

  @ApiProperty({
    example: '408f9641-6052-4f9f-8226-3cb950678cab',
    nullable: true,
  })
  parentId!: string | null;
}
