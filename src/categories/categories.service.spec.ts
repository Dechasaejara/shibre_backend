import { ConflictException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

const user: AuthenticatedUser = {
  deviceId: null,
  phoneNumber: '+251911111111',
  role: 'USER',
  sessionId: 'session',
  userId: 'user-1',
};

function setup() {
  const prisma = {
    category: { findFirst: jest.fn(), delete: jest.fn() },
  };
  return {
    prisma,
    service: new CategoriesService(prisma as unknown as PrismaService),
  };
}

describe('CategoriesService deletion', () => {
  it('deletes an unused custom category owned by the user', async () => {
    const { prisma, service } = setup();
    prisma.category.findFirst.mockResolvedValue({ id: 'category-1', _count: { children: 0, transactions: 0 } });

    await expect(service.deleteCategory(user, 'category-1')).resolves.toEqual({ id: 'category-1' });
    expect(prisma.category.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'category-1', userId: user.userId }),
    }));
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'category-1' } });
  });

  it('hides preset and other users categories', async () => {
    const { prisma, service } = setup();
    prisma.category.findFirst.mockResolvedValue(null);
    await expect(service.deleteCategory(user, 'foreign')).rejects.toThrow(NotFoundException);
  });

  it('keeps categories referenced by transactions or children', async () => {
    const { prisma, service } = setup();
    prisma.category.findFirst.mockResolvedValue({ id: 'category-1', _count: { children: 0, transactions: 1 } });
    await expect(service.deleteCategory(user, 'category-1')).rejects.toThrow(ConflictException);
    expect(prisma.category.delete).not.toHaveBeenCalled();
  });
});
