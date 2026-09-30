import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthSessionStatus,
  DeviceStatus,
  Prisma,
  User,
  UserStatus,
} from '@prisma/client';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';
import { maskPhone, shortId } from '../common/logging';
import {
  AuthSessionResponseDto,
  LogoutResponseDto,
  RefreshTokenResponseDto,
} from './dto/auth-response.dto';
import {
  AuthDeviceInputDto,
  LoginDto,
  RegisterDto,
} from './dto/credentials.dto';
import { LogoutDto, RefreshTokenDto } from './dto/token.dto';

export interface AuthenticatedUser {
  deviceId: string | null;
  phoneNumber: string;
  role: string;
  sessionId: string;
  userId: string;
}

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; p: number; r: number },
) => Promise<Buffer>;

const scryptParams = { N: 16384, p: 1, r: 8 };
const scryptKeyLength = 64;
const maxFailedLogins = 5;
const lockoutMinutes = 15;
const invalidCredentialsMessage = 'Invalid phone number or password';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSessionResponseDto> {
    const passwordHash = await this.hashPassword(dto.password);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            passwordHash,
            phoneNumber: dto.phoneNumber,
            status: UserStatus.ACTIVE,
          },
        });

        this.logger.log(`Registered user=${shortId(user.id)} phone=${maskPhone(user.phoneNumber)}`);
        return this.createSession(tx, user, dto.device);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(`Registration rejected: phone ${maskPhone(dto.phoneNumber)} already registered`);
        throw new ConflictException('Phone number is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthSessionResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber },
    });

    if (!user?.passwordHash) {
      // Equalize timing so unknown numbers are indistinguishable.
      await this.hashPassword(dto.password);
      this.logger.warn(`Login failed: unknown account phone=${maskPhone(dto.phoneNumber)}`);
      throw new UnauthorizedException(invalidCredentialsMessage);
    }

    const now = new Date();

    if (user.lockedUntil && user.lockedUntil > now) {
      this.logger.warn(`Login blocked: user=${shortId(user.id)} locked until ${user.lockedUntil.toISOString()}`);
      throw new UnauthorizedException(
        'Too many failed attempts. Try again later.',
      );
    }

    const valid = await this.verifyPassword(dto.password, user.passwordHash);

    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const locked = attempts >= maxFailedLogins;
      await this.prisma.user.update({
        data: {
          failedLoginAttempts: locked ? 0 : attempts,
          lockedUntil: locked ? this.addMinutes(now, lockoutMinutes) : null,
        },
        where: { id: user.id },
      });
      this.logger.warn(
        locked
          ? `Login failed: wrong password, user=${shortId(user.id)} now locked for ${lockoutMinutes} min`
          : `Login failed: wrong password, user=${shortId(user.id)} attempt ${attempts}/${maxFailedLogins}`,
      );
      throw new UnauthorizedException(invalidCredentialsMessage);
    }

    if (user.status !== UserStatus.ACTIVE) {
      this.logger.warn(`Login refused: user=${shortId(user.id)} status=${user.status}`);
      throw new UnauthorizedException(invalidCredentialsMessage);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        data: { failedLoginAttempts: 0, lockedUntil: null },
        where: { id: user.id },
      });

      this.logger.log(`Login ok: user=${shortId(user.id)} role=${user.role} device=${dto.device?.platform ?? '-'}`);
      return this.createSession(tx, updated, dto.device);
    });
  }

  private async createSession(
    tx: Prisma.TransactionClient,
    user: User,
    deviceInput: AuthDeviceInputDto,
  ): Promise<AuthSessionResponseDto> {
    const tokenPair = this.createTokenPair();
    const now = new Date();
    const expiresAt = this.addMinutes(
      now,
      this.configService.getOrThrow<number>('ACCESS_TOKEN_TTL_MINUTES'),
    );
    const refreshExpiresAt = this.addDays(
      now,
      this.configService.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS'),
    );

    const device = await tx.device.upsert({
      create: {
        appVersion: deviceInput.appVersion,
        deviceKey: deviceInput.deviceKey,
        platform: deviceInput.platform,
        pushToken: deviceInput.pushToken,
        userId: user.id,
      },
      update: {
        appVersion: deviceInput.appVersion,
        lastSyncAt: now,
        platform: deviceInput.platform,
        pushToken: deviceInput.pushToken,
        revokedAt: null,
        status: DeviceStatus.TRUSTED,
      },
      where: {
        userId_deviceKey: {
          deviceKey: deviceInput.deviceKey,
          userId: user.id,
        },
      },
    });

    await tx.authSession.create({
      data: {
        accessTokenHash: this.hashSecret(tokenPair.accessToken),
        deviceId: device.id,
        expiresAt,
        refreshExpiresAt,
        refreshTokenHash: this.hashSecret(tokenPair.refreshToken),
        userId: user.id,
      },
    });

    return {
      accessToken: tokenPair.accessToken,
      device: {
        deviceKey: device.deviceKey,
        id: device.id,
        platform: device.platform,
      },
      expiresAt: expiresAt.toISOString(),
      refreshExpiresAt: refreshExpiresAt.toISOString(),
      refreshToken: tokenPair.refreshToken,
      user: {
        faydaLinked: Boolean(user.faydaIdHash),
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: this.hashSecret(dto.refreshToken) },
    });

    if (
      !session ||
      session.status !== AuthSessionStatus.ACTIVE ||
      session.refreshExpiresAt <= new Date()
    ) {
      this.logger.warn(
        `Token refresh rejected: ${!session ? 'unknown token' : session.status !== AuthSessionStatus.ACTIVE ? `session ${session.status}` : 'refresh token expired'}${session ? ` user=${shortId(session.userId)}` : ''}`,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenPair = this.createTokenPair();
    const now = new Date();
    const expiresAt = this.addMinutes(
      now,
      this.configService.getOrThrow<number>('ACCESS_TOKEN_TTL_MINUTES'),
    );
    const refreshExpiresAt = this.addDays(
      now,
      this.configService.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS'),
    );

    await this.prisma.authSession.update({
      data: {
        accessTokenHash: this.hashSecret(tokenPair.accessToken),
        expiresAt,
        refreshExpiresAt,
        refreshTokenHash: this.hashSecret(tokenPair.refreshToken),
      },
      where: { id: session.id },
    });

    return {
      accessToken: tokenPair.accessToken,
      expiresAt: expiresAt.toISOString(),
      refreshExpiresAt: refreshExpiresAt.toISOString(),
      refreshToken: tokenPair.refreshToken,
    };
  }

  async logout(dto: LogoutDto): Promise<LogoutResponseDto> {
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: this.hashSecret(dto.refreshToken) },
    });

    if (!session) {
      return { revoked: true };
    }

    await this.prisma.authSession.update({
      data: {
        revokedAt: new Date(),
        status: AuthSessionStatus.REVOKED,
      },
      where: { id: session.id },
    });

    this.logger.log(`Logout: user=${shortId(session.userId)} session revoked`);
    return { revoked: true };
  }

  async validateAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const session = await this.prisma.authSession.findUnique({
      include: {
        device: true,
        user: true,
      },
      where: { accessTokenHash: this.hashSecret(accessToken) },
    });

    if (
      !session ||
      session.status !== AuthSessionStatus.ACTIVE ||
      session.expiresAt <= new Date() ||
      session.device?.status === DeviceStatus.REVOKED
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    return {
      deviceId: session.deviceId,
      phoneNumber: session.user.phoneNumber,
      role: session.user.role,
      sessionId: session.id,
      userId: session.userId,
    };
  }

  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const device = await tx.device.findFirst({
        where: { id: deviceId, userId },
      });

      if (!device) {
        throw new UnauthorizedException('Device is not owned by this user');
      }

      await tx.device.update({
        data: {
          revokedAt: new Date(),
          status: DeviceStatus.REVOKED,
        },
        where: { id: device.id },
      });
      await tx.authSession.updateMany({
        data: {
          revokedAt: new Date(),
          status: AuthSessionStatus.REVOKED,
        },
        where: {
          deviceId: device.id,
          status: AuthSessionStatus.ACTIVE,
        },
      });
    });
  }

  private createTokenPair(): { accessToken: string; refreshToken: string } {
    return {
      accessToken: randomBytes(32).toString('base64url'),
      refreshToken: randomBytes(48).toString('base64url'),
    };
  }

  private hashSecret(value: string): string {
    return createHash('sha256')
      .update(value)
      .update(this.configService.getOrThrow<string>('AUTH_SECRET'))
      .digest('hex');
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await scryptAsync(
      password,
      salt,
      scryptKeyLength,
      scryptParams,
    );
    const { N, p, r } = scryptParams;

    return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${derived.toString('base64')}`;
  }

  private async verifyPassword(
    password: string,
    stored: string,
  ): Promise<boolean> {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');

    if (scheme !== 'scrypt' || !saltB64 || !hashB64) {
      return false;
    }

    const expected = Buffer.from(hashB64, 'base64');
    const actual = await scryptAsync(
      password,
      Buffer.from(saltB64, 'base64'),
      expected.length,
      { N: Number(n), p: Number(p), r: Number(r) },
    );

    return timingSafeEqual(actual, expected);
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60_000);
  }
}
