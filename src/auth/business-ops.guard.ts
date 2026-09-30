import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedRequest } from './access-token.guard';

@Injectable()
export class BusinessOpsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user.role === 'BUSINESS_OPS' || request.user.role === 'ADMIN') {
      return true;
    }
    throw new ForbiddenException('Business operations role required');
  }
}