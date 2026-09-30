import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, CategoryKind } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(
    user: AuthenticatedUser,
  ): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      where: {
        OR: [{ userId: null }, { userId: user.userId }],
      },
    });

    return categories.map((category) => this.toResponse(category));
  }

  async createCategory(
    user: AuthenticatedUser,
    dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.create({
      data: {
        color: dto.color,
        icon: dto.icon,
        kind: CategoryKind.CUSTOM,
        name: dto.name,
        parentId: dto.parentId,
        userId: user.userId,
      },
    });

    return this.toResponse(category);
  }

  async updateCategory(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const existing = await this.prisma.category.findFirst({
      where: {
        id,
        kind: CategoryKind.CUSTOM,
        userId: user.userId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Custom category not found: ${id}`);
    }

    const category = await this.prisma.category.update({
      data: {
        color: dto.color,
        icon: dto.icon,
        name: dto.name,
        parentId: dto.parentId,
      },
      where: { id },
    });

    return this.toResponse(category);
  }

  async deleteCategory(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ id: string }> {
    const category = await this.prisma.category.findFirst({
      include: { _count: { select: { children: true, transactions: true } } },
      where: { id, kind: CategoryKind.CUSTOM, userId: user.userId },
    });
    if (!category) {
      throw new NotFoundException(`Custom category not found: ${id}`);
    }
    if (category._count.children > 0 || category._count.transactions > 0) {
      throw new ConflictException(
        'Categories used by transactions or child categories cannot be deleted',
      );
    }

    await this.prisma.category.delete({ where: { id } });
    return { id };
  }

  private toResponse(category: Category): CategoryResponseDto {
    return {
      color: category.color,
      icon: category.icon,
      id: category.id,
      kind: category.kind,
      name: category.name,
      parentId: category.parentId,
    };
  }
}
