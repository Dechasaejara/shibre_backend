import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: '5a8f5d5e-07d3-412a-8756-b2e2531d0831' })
  id!: string;

  @ApiProperty({ example: '+251911111111' })
  phoneNumber!: string;

  @ApiProperty({ example: true })
  faydaLinked!: boolean;

  @ApiProperty({ example: 'USER' })
  role!: string;
}

export class AuthDeviceDto {
  @ApiProperty({ example: '89a97454-bfa2-43d0-a3f6-8863a3b37c24' })
  id!: string;

  @ApiProperty({ example: 'android-device-install-id' })
  deviceKey!: string;

  @ApiProperty({ example: 'android' })
  platform!: string;
}

export class AuthTokensDto {
  @ApiProperty({ example: 'opaque-access-token' })
  accessToken!: string;

  @ApiProperty({ example: 'opaque-refresh-token' })
  refreshToken!: string;

  @ApiProperty({ example: '2026-09-25T13:00:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: '2026-10-25T12:00:00.000Z' })
  refreshExpiresAt!: string;
}

export class AuthSessionResponseDto extends AuthTokensDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ type: AuthDeviceDto })
  device!: AuthDeviceDto;
}

export class RefreshTokenResponseDto extends AuthTokensDto {}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  revoked!: boolean;
}
