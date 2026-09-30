import { Injectable, NotFoundException } from '@nestjs/common';
import { Device } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DeviceActionResponseDto,
  DeviceResponseDto,
} from './dto/device-response.dto';

@Injectable()
export class DevicesService {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async listDevices(user: AuthenticatedUser): Promise<DeviceResponseDto[]> {
    const devices = await this.prisma.device.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      where: { userId: user.userId },
    });

    return devices.map((device) => this.toResponse(device));
  }

  async getCurrentDevice(user: AuthenticatedUser): Promise<DeviceResponseDto> {
    if (!user.deviceId) {
      throw new NotFoundException('Current device is not available');
    }

    const device = await this.prisma.device.findFirst({
      where: { id: user.deviceId, userId: user.userId },
    });

    if (!device) {
      throw new NotFoundException('Current device not found');
    }

    return this.toResponse(device);
  }

  async revokeDevice(
    user: AuthenticatedUser,
    deviceId: string,
  ): Promise<DeviceActionResponseDto> {
    await this.authService.revokeDevice(user.userId, deviceId);
    return { updated: true };
  }

  private toResponse(device: Device): DeviceResponseDto {
    return {
      appVersion: device.appVersion,
      createdAt: device.createdAt.toISOString(),
      deviceKey: device.deviceKey,
      id: device.id,
      lastSyncAt: device.lastSyncAt?.toISOString() ?? null,
      platform: device.platform,
      status: device.status,
    };
  }
}
