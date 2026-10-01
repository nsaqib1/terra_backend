import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ResourceStorageService } from './resource.storage.service';
import { ListResourcesDto } from './dto/list-resources.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ResourceStorageService,
  ) {}

  async list(dto: ListResourcesDto, includeUnpublished = false) {
    const community = await this.prisma.community.findFirst({
      where: { id: dto.communityId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const tagIds = dto.tagIds?.split(',').map((id) => id.trim()).filter(Boolean) ?? [];
    const where = {
      communityId: dto.communityId,
      ...(includeUnpublished ? { deletedAt: null } : { status: 'PUBLISHED' as const, deletedAt: null }),
      ...(dto.q
        ? {
            OR: [
              { title: { contains: dto.q, mode: 'insensitive' as const } },
              { description: { contains: dto.q, mode: 'insensitive' as const } },
              { originalFilename: { contains: dto.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(dto.mimeType ? { mimeType: dto.mimeType } : {}),
      ...(tagIds.length
        ? {
            AND: tagIds.map((tagId) => ({ tags: { some: { tagId } } })),
          }
        : {}),
    };

    const orderBy =
      dto.sort === 'downloads'
        ? { downloadCount: 'desc' as const }
        : dto.sort === 'oldest'
          ? { createdAt: 'asc' as const }
          : { createdAt: 'desc' as const };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.resource.findMany({
        where,
        orderBy,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        select: this.resourceSelect(),
      }),
      this.prisma.resource.count({ where }),
    ]);

    return {
      data: data.map((resource) => this.serializeResource(resource)),
      meta: {
        page: dto.page,
        limit: dto.limit,
        total,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }

  async getById(id: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id, status: 'PUBLISHED', deletedAt: null },
      select: this.resourceSelect(),
    });
    if (!resource) throw new NotFoundException('Resource not found');
    return this.serializeResource(resource);
  }

  async getAdminById(id: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id },
      select: this.resourceSelect(),
    });
    if (!resource) throw new NotFoundException('Resource not found');
    return this.serializeResource(resource);
  }

  async getFile(id: string, incrementDownload = false) {
    const resource = await this.prisma.resource.findFirst({
      where: { id, status: 'PUBLISHED', deletedAt: null },
      select: {
        id: true,
        storageKey: true,
        mimeType: true,
        size: true,
        originalFilename: true,
      },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    const file = await this.storage.getFile(resource.storageKey);
    if (!file) throw new NotFoundException('Resource file not found');

    if (incrementDownload) {
      await this.prisma.resource.update({
        where: { id: resource.id },
        data: { downloadCount: { increment: 1 } },
      });
    }

    return { resource, ...file };
  }

  async createFromUpload(
    uploadedById: string,
    file: Express.Multer.File,
    communityId: string,
    title: string,
    description: string | undefined,
    tagIds: string[],
  ) {
    if (!file?.path) throw new BadRequestException('File is required');

    let storageKey: string | null = null;
    try {
      this.validateFile(file);
      if (!communityId || !title?.trim()) {
        throw new BadRequestException('Community and title are required');
      }

      const community = await this.prisma.community.findFirst({
        where: { id: communityId, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      if (!community) throw new NotFoundException('Community not found');

      const uniqueTagIds = [...new Set(tagIds)];
      const validTags = await this.prisma.resourceTagDefinition.findMany({
        where: { id: { in: uniqueTagIds }, communityId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (validTags.length !== uniqueTagIds.length) {
        throw new BadRequestException('One or more resource tags are invalid for this community');
      }

      const extension = this.extension(file.originalname);
      const stored = await this.storage.saveFromTempFile(file.path, extension);
      storageKey = stored.storageKey;

      try {
        const resource = await this.prisma.$transaction(async (tx) => {
          const created = await tx.resource.create({
            data: {
              communityId,
              uploadedById,
              title: title.trim(),
              description: description?.trim() || null,
              originalFilename: file.originalname,
              storageKey: stored.storageKey,
              mimeType: file.mimetype || 'application/octet-stream',
              size: file.size,
              status: 'PUBLISHED',
              publishedAt: new Date(),
              tags: {
                create: validTags.map((tag) => ({ tagId: tag.id })),
              },
            },
            select: this.resourceSelect(),
          });

          for (const tag of validTags) {
            await tx.resourceTagDefinition.update({
              where: { id: tag.id },
              data: { usageCount: { increment: 1 } },
            });
          }

          return created;
        });
        return this.serializeResource(resource);
      } catch (error) {
        await this.storage.delete(stored.storageKey);
        storageKey = null;
        throw error;
      }
    } finally {
      if (file.path && !storageKey) {
        await this.storage.deleteTempFile(file.path);
      }
    }
  }

  async update(id: string, dto: UpdateResourceDto) {
    const resource = await this.prisma.resource.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, communityId: true },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    if (dto.tagIds) {
      const uniqueTagIds = [...new Set(dto.tagIds)];
      const valid = await this.prisma.resourceTagDefinition.findMany({
        where: { id: { in: uniqueTagIds }, communityId: resource.communityId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (valid.length !== uniqueTagIds.length) {
        throw new BadRequestException('One or more resource tags are invalid for this community');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.tagIds) {
        const existing = await tx.resourceTag.findMany({
          where: { resourceId: id },
          select: { tagId: true },
        });
        const next = new Set(dto.tagIds);
        const previous = new Set(existing.map((tag) => tag.tagId));

        await tx.resourceTag.deleteMany({ where: { resourceId: id } });
        if (dto.tagIds.length) {
          await tx.resourceTag.createMany({
            data: [...new Set(dto.tagIds)].map((tagId) => ({ resourceId: id, tagId })),
          });
        }

        for (const tagId of previous) {
          if (!next.has(tagId)) {
            await tx.resourceTagDefinition.update({ where: { id: tagId }, data: { usageCount: { decrement: 1 } } });
          }
        }
        for (const tagId of next) {
          if (!previous.has(tagId)) {
            await tx.resourceTagDefinition.update({ where: { id: tagId }, data: { usageCount: { increment: 1 } } });
          }
        }
      }

      const updated = await tx.resource.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        },
        select: this.resourceSelect(),
      });

      return this.serializeResource(updated);
    });
  }

  async unpublish(id: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!resource) throw new NotFoundException('Resource not found');
    if (resource.status === 'UNPUBLISHED') throw new BadRequestException('Resource is already unpublished');

    const updated = await this.prisma.resource.update({
      where: { id },
      data: { status: 'UNPUBLISHED' },
      select: this.resourceSelect(),
    });
    return this.serializeResource(updated);
  }

  async publish(id: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!resource) throw new NotFoundException('Resource not found');
    if (resource.status === 'PUBLISHED') throw new BadRequestException('Resource is already published');

    const updated = await this.prisma.resource.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      select: this.resourceSelect(),
    });
    return this.serializeResource(updated);
  }

  async hardDelete(id: string) {
    const resource = await this.prisma.resource.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, storageKey: true },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    await this.prisma.$transaction(async (tx) => {
      // Decrement tag usage counts before deleting
      const tags = await tx.resourceTag.findMany({
        where: { resourceId: id },
        select: { tagId: true },
      });
      for (const tag of tags) {
        await tx.resourceTagDefinition.update({
          where: { id: tag.tagId },
          data: { usageCount: { decrement: 1 } },
        });
      }
      // Permanently delete the record (cascade deletes resource tags)
      await tx.resource.delete({ where: { id } });
    });

    // Delete the stored file after DB cleanup
    await this.storage.delete(resource.storageKey);

    return { id, deleted: true };
  }

  private serializeResource<T extends { size: bigint }>(resource: T) {
    return {
      ...resource,
      size: Number(resource.size),
    };
  }

  private resourceSelect() {
    return {
      id: true,
      communityId: true,
      community: { select: { id: true, name: true, slug: true } },
      title: true,
      description: true,
      originalFilename: true,
      mimeType: true,
      size: true,
      status: true,
      downloadCount: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      tags: {
        where: { tag: { status: 'ACTIVE' as const } },
        select: {
          tag: {
            select: { id: true, name: true, slug: true, description: true },
          },
        },
      },
    } as const;
  }

  private validateFile(file: Express.Multer.File) {
    const extension = this.extension(file.originalname);
    const allowedExtensions = new Set([
      'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',
      'txt', 'csv', 'md', 'zip', '7z', 'rar',
      'exe', 'msi', 'apk', 'dmg', 'deb', 'rpm',
      'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'tiff', 'avif',
    ]);

    if (!allowedExtensions.has(extension)) {
      throw new BadRequestException(`Unsupported resource file type: .${extension || 'unknown'}`);
    }

    if (!file.size || file.size <= 0) {
      throw new BadRequestException('Resource file is empty');
    }
  }

  private extension(filename: string) {
    const raw = filename.split('.').pop()?.toLowerCase() ?? '';
    return raw.replace(/[^a-z0-9]/g, '').slice(0, 10);
  }
}
