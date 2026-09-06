import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { ListTagsDto } from './dto/list-tags.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagStatus } from '../generated/prisma/enums';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) { }

  async list(dto: ListTagsDto) {
    const { communityId, q, page = 1, limit = 20 } = dto;

    const community = await this.prisma.community.findFirst({
      where: {
        id: communityId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const where = {
      communityId,
      status: TagStatus.ACTIVE,
      ...(q
        ? {
          OR: [
            {
              name: {
                contains: q,
                mode: 'insensitive' as const,
              },
            },
            {
              slug: {
                contains: q.toLowerCase(),
                mode: 'insensitive' as const,
              },
            },
          ],
        }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.tag.findMany({
        where,
        orderBy: [
          {
            usageCount: 'desc',
          },
          {
            name: 'asc',
          },
        ],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          usageCount: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      this.prisma.tag.count({
        where,
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(dto: CreateTagDto) {
    const community = await this.prisma.community.findFirst({
      where: {
        id: dto.communityId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const name = dto.name.trim();

    const slug =
      dto.slug?.trim().toLowerCase() ??
      this.generateSlug(name);

    const existing = await this.prisma.tag.findUnique({
      where: {
        communityId_slug: {
          communityId: dto.communityId,
          slug,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'A tag with this name already exists in this community',
      );
    }

    return this.prisma.tag.create({
      data: {
        communityId: dto.communityId,
        name,
        slug,
        description: dto.description?.trim() || null,
      },
      select: {
        id: true,
        communityId: true,
        name: true,
        slug: true,
        description: true,
        usageCount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateTagDto) {
    const tag = await this.prisma.tag.findUnique({
      where: {
        id,
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return this.prisma.tag.update({
      where: {
        id,
      },
      data: {
        ...(dto.name !== undefined
          ? {
            name: dto.name.trim(),
          }
          : {}),

        ...(dto.description !== undefined
          ? {
            description: dto.description.trim() || null,
          }
          : {}),

        ...(dto.status !== undefined
          ? {
            status: dto.status,
          }
          : {}),
      },
      select: {
        id: true,
        communityId: true,
        name: true,
        slug: true,
        description: true,
        usageCount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async archive(id: string) {
    const tag = await this.prisma.tag.findUnique({
      where: {
        id,
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return this.prisma.tag.update({
      where: {
        id,
      },
      data: {
        status: TagStatus.ARCHIVED,
      },
      select: {
        id: true,
        communityId: true,
        name: true,
        slug: true,
        description: true,
        usageCount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  private generateSlug(name: string): string {
    return name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}