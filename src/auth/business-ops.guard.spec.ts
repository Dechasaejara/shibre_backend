import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { BusinessOpsGuard } from './business-ops.guard';

function executionContext(role: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } }),
    }),
  } as unknown as ExecutionContext;
}

describe('BusinessOpsGuard', () => {
  const guard = new BusinessOpsGuard();

  it.each(['USER', 'UNKNOWN'])('rejects %s', (role) => {
    expect(() => guard.canActivate(executionContext(role))).toThrow(ForbiddenException);
  });

  it.each(['BUSINESS_OPS', 'ADMIN'])('allows %s', (role) => {
    expect(guard.canActivate(executionContext(role))).toBe(true);
  });
});