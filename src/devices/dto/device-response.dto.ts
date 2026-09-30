import { ApiProperty } from '@nestjs/swagger';

export class DeviceResponseDto {
  @ApiProperty({ example: '408f9641-6052-4f9f-8226-3cb950678cab' })
  id!: string;

  @ApiProperty({ example: 'android-installation-key' })
  deviceKey!: string;

  @ApiProperty({ example: 'android' })
  platform!: string;

  @ApiProperty({ example: '1.0.0', nullable: true })
  appVersion!: string | null;

  @ApiProperty({ example: 'TRUSTED' })
  status!: string;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z', nullable: true })
  lastSyncAt!: string | null;

  @ApiProperty({ example: '2026-09-25T12:00:00.000Z' })
  createdAt!: string;
}

export class DeviceActionResponseDto {
  @ApiProperty({ example: true })
  updated!: boolean;
}
