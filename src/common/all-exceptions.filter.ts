import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';

/** Logs unexpected errors with their stack, then lets Nest build the normal response. */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request & { requestId?: string }>();
    const where = request ? `${request.method} ${request.originalUrl.split('?')[0]} req=${request.requestId ?? '-'}` : 'non-http';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) this.logger.error(`${where} ${exception.message}`, exception.stack);
      else this.logger.debug(`${where} ${status} ${exception.message}`);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(`${where} Prisma ${exception.code} on ${JSON.stringify(exception.meta ?? {})}`, exception.stack);
    } else if (exception instanceof Error) {
      this.logger.error(`${where} ${exception.name}: ${exception.message}`, exception.stack);
    } else {
      this.logger.error(`${where} Non-error thrown: ${String(exception)}`);
    }

    super.catch(exception, host);
  }
}
