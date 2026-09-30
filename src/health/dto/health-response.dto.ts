import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 12.34 })
  uptimeSeconds!: number;
}
