import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateResourceTagDto } from './dto/create-resource-tag.dto';
import { UpdateResourceTagDto } from './dto/update-resource-tag.dto';

@Injectable()
export class ResourceTagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(communityId: string, q?: string) {
    const where = {
      communityId,
      status: 'ACTIVE' as const,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { slug: { contains: q.toLowerCase(), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    return this.prisma.resourceTagDefinition.findMany({
      where,
      orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
      take: 100,
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

  async create(dto: CreateResourceTagDto) {
    const community = await this.prisma.community.findFirst({
      where: { id: dto.communityId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const name = dto.name.trim();
    const slug = dto.slug?.trim().toLowerCase() ?? this.slugify(name);

    const existing = await this.prisma.resourceTagDefinition.findUnique({
      where: { communityId_slug: { communityId: dto.communityId, slug } },
    });
    if (existing) throw new ConflictException('A resource tag with this name already exists in this community');

    return this.prisma.resourceTagDefinition.create({
      data: {
        communityId: dto.communityId,
        name,
        slug,
        description: dto.description?.trim() || null,
      },
    });
  }

  async update(id: string, dto: UpdateResourceTagDto) {
    const tag = await this.prisma.resourceTagDefinition.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Resource tag not found');

    return this.prisma.resourceTagDefinition.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  private slugify(value: string) {
    const slug = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
    if (!slug) throw new ConflictException('Unable to generate a valid resource tag slug');
    return slug;
  }
}
