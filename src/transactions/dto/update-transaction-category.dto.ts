import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateTransactionCategoryDto {
  @ApiProperty({
    example: '408f9641-6052-4f9f-8226-3cb950678cab',
    nullable: true,
    description: 'Preset or user-owned category; null removes the category',
  })
  @IsOptional()
  @IsUUID()
  categoryId!: string | null;
}
