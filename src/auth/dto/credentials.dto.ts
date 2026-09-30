import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AuthDeviceInputDto {
  @ApiProperty({ example: 'android-device-install-id' })
  @IsString()
  @IsNotEmpty()
  deviceKey!: string;

  @ApiProperty({ example: 'android' })
  @IsString()
  @IsNotEmpty()
  platform!: string;

  @ApiProperty({ example: '1.0.0', required: false })
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiProperty({ example: 'expo-push-token', required: false })
  @IsOptional()
  @IsString()
  pushToken?: string;
}

export class LoginDto {
  @ApiProperty({ example: '+251911111111' })
  @IsPhoneNumber()
  phoneNumber!: string;

  @ApiProperty({ example: 'correct horse battery' })
  @IsString()
  @MaxLength(128)
  password!: string;

  @ApiProperty({ type: AuthDeviceInputDto })
  @ValidateNested()
  @Type(() => AuthDeviceInputDto)
  device!: AuthDeviceInputDto;
}

export class RegisterDto {
  @ApiProperty({ example: '+251911111111' })
  @IsPhoneNumber()
  phoneNumber!: string;

  @ApiProperty({ example: 'correct horse battery', minLength: 8 })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiProperty({ type: AuthDeviceInputDto })
  @ValidateNested()
  @Type(() => AuthDeviceInputDto)
  device!: AuthDeviceInputDto;
}
