import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.service';
import {
  DeviceActionResponseDto,
  DeviceResponseDto,
} from './dto/device-response.dto';
import { DevicesService } from './devices.service';

@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @ApiOkResponse({ type: [DeviceResponseDto] })
  listDevices(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeviceResponseDto[]> {
    return this.devicesService.listDevices(user);
  }

  @Get('current')
  @ApiOkResponse({ type: DeviceResponseDto })
  getCurrentDevice(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeviceResponseDto> {
    return this.devicesService.getCurrentDevice(user);
  }

  @Patch(':id/revoke')
  @ApiOkResponse({ type: DeviceActionResponseDto })
  revokeDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DeviceActionResponseDto> {
    return this.devicesService.revokeDevice(user, id);
  }
}
