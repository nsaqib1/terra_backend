import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ListToolsDto } from './dto/list-tools.dto';
import { AdminToolQueryDto } from './dto/admin-tool-query.dto';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { CreateToolVersionDto } from './dto/create-tool-version.dto';
import { UpdateToolVersionDto } from './dto/update-tool-version.dto';
import { ToolBuildStorageService } from './tool-build.storage.service';

@Injectable()
export class ToolService {
  constructor(private readonly prisma: PrismaService, private readonly buildStorage: ToolBuildStorageService) {}

  async list(dto: ListToolsDto) {
    const tools = await this.prisma.tool.findMany({
      where: {
        status: 'PUBLISHED', deletedAt: null,
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.q?.trim() ? { OR: [
          { title: { contains: dto.q.trim(), mode: 'insensitive' as const } },
          { description: { contains: dto.q.trim(), mode: 'insensitive' as const } },
        ] } : {}),
        ...(dto.communityId ? { communities: { some: { communityId: dto.communityId } } } : {}),
      },
      orderBy: { title: 'asc' },
      select: this.publicSelect(),
    });
    return tools.map((tool) => this.serialize(tool));
  }

  async findBySlug(slug: string) {
    const tool = await this.prisma.tool.findFirst({ where: { slug: slug.toLowerCase(), status: 'PUBLISHED', deletedAt: null }, select: this.publicSelect() });
    if (!tool) throw new NotFoundException('Tool not found');
    return this.serialize(tool);
  }

  async adminList(dto: AdminToolQueryDto) {
    const page = dto.page ?? 1; const limit = dto.limit ?? 20;
    const where: any = {};
    if (dto.status) where.status = dto.status;
    if (dto.category) where.category = dto.category;
    if (dto.type) where.type = dto.type;
    if (dto.communityId) where.communities = { some: { communityId: dto.communityId } };
    if (dto.search?.trim()) { const q = dto.search.trim(); where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }]; }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.tool.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { communities: { include: { community: { select: { id: true, name: true, slug: true } } } }, versions: { orderBy: { createdAt: 'desc' } } } }),
      this.prisma.tool.count({ where }),
    ]);
    return { data: data.map((tool) => ({ ...tool, communities: tool.communities.map((x) => x.community), launchUrl: tool.currentVersionId ? `${(process.env.TOOL_PUBLIC_URL || 'http://tools.localhost:8080').replace(/\/$/, '')}/${tool.slug}/` : null })), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async adminGetById(id: string) {
    const tool = await this.prisma.tool.findUnique({ where: { id }, include: { communities: { include: { community: { select: { id: true, name: true, slug: true } } } }, versions: { orderBy: { createdAt: 'desc' } } } });
    if (!tool) throw new NotFoundException('Tool not found');
    return { ...tool, communities: tool.communities.map((x) => x.community), launchUrl: tool.currentVersionId ? `${(process.env.TOOL_PUBLIC_URL || 'http://tools.localhost:8080').replace(/\/$/, '')}/${tool.slug}/` : null };
  }

  async adminCreate(dto: CreateToolDto) {
    await this.validateCommunityIds(dto.communityIds ?? []);
    if (dto.status === 'PUBLISHED') throw new BadRequestException('Create the tool as a draft, upload and publish a version, then publish the tool');
    try {
      const created = await this.prisma.tool.create({ data: {
        title: dto.title.trim(), slug: dto.slug.toLowerCase(), description: dto.description?.trim() || null,
        thumbnailUrl: dto.thumbnailUrl?.trim() || null, category: dto.category ?? 'OTHER', type: dto.type ?? 'CLIENT', status: dto.status ?? 'DRAFT',
        communities: dto.communityIds?.length ? { create: dto.communityIds.map((communityId) => ({ community: { connect: { id: communityId } } })) } : undefined,
      }, select: { id: true } });
      return this.adminGetById(created.id);
    } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('A tool with this slug already exists'); throw e; }
  }

  async adminUpdate(id: string, dto: UpdateToolDto) {
    const existing = await this.prisma.tool.findUnique({ where: { id }, select: { id: true, slug: true, currentVersionId: true, deletedAt: true } });
    if (!existing) throw new NotFoundException('Tool not found');
    const newSlug = dto.slug?.trim().toLowerCase();
    if (newSlug && newSlug !== existing.slug && existing.currentVersionId) throw new BadRequestException('A tool slug cannot change after a version has been published');
    if (dto.status === 'PUBLISHED') await this.assertPublishable(id);
    try {
      await this.prisma.tool.update({ where: { id }, data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug.trim().toLowerCase() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.thumbnailUrl !== undefined ? { thumbnailUrl: dto.thumbnailUrl.trim() || null } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}), ...(dto.status !== undefined ? { status: dto.status } : {}),
      } });
    } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('A tool with this slug already exists'); throw e; }
    return this.adminGetById(id);
  }

  async adminUpdateCommunities(id: string, communityIds: string[]) {
    await this.ensureTool(id); await this.validateCommunityIds(communityIds);
    await this.prisma.$transaction(async (tx) => {
      await tx.toolCommunity.deleteMany({ where: { toolId: id } });
      if (communityIds.length) await tx.toolCommunity.createMany({ data: communityIds.map((communityId) => ({ toolId: id, communityId })) });
    });
    return this.adminGetById(id);
  }

  async adminDelete(id: string) {
    await this.ensureTool(id);
    await this.prisma.tool.update({ where: { id }, data: { status: 'ARCHIVED', deletedAt: new Date() } });
    return this.adminGetById(id);
  }

  async adminUnpublish(id: string) {
    await this.ensureTool(id);
    await this.prisma.tool.update({ where: { id }, data: { status: 'UNPUBLISHED' } });
    return this.adminGetById(id);
  }

  async adminPublish(id: string) {
    await this.assertPublishable(id);
    await this.prisma.tool.update({ where: { id }, data: { status: 'PUBLISHED' } });
    return this.adminGetById(id);
  }

  async adminListVersions(toolId: string) {
    await this.ensureTool(toolId);
    return this.prisma.toolVersion.findMany({ where: { toolId }, orderBy: { createdAt: 'desc' } });
  }

  async adminCreateVersion(toolId: string, dto: CreateToolVersionDto) {
    await this.ensureTool(toolId);
    try { return await this.prisma.toolVersion.create({ data: { toolId, version: dto.version.trim(), releaseNotes: dto.releaseNotes?.trim() || null } }); }
    catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('This tool version already exists'); throw e; }
  }

  async adminUpdateVersion(toolId: string, versionId: string, dto: UpdateToolVersionDto) {
    const version = await this.prisma.toolVersion.findFirst({ where: { id: versionId, toolId } });
    if (!version) throw new NotFoundException('Tool version not found');
    if (version.status !== 'DRAFT') throw new BadRequestException('Only draft versions can be updated');
    return this.prisma.toolVersion.update({ where: { id: versionId }, data: { ...(dto.releaseNotes !== undefined ? { releaseNotes: dto.releaseNotes.trim() || null } : {}) } });
  }

  async adminUploadBuild(toolId: string, versionId: string, file: Express.Multer.File) {
    if (!file?.path) throw new BadRequestException('Tool build ZIP file is required');
    const version = await this.prisma.toolVersion.findFirst({ where: { id: versionId, toolId } });
    if (!version) { await this.buildStorage.deleteBuild(null); throw new NotFoundException('Tool version not found'); }
    if (version.status !== 'DRAFT') throw new BadRequestException('Only draft versions can receive a build');
    if (version.buildPath) throw new BadRequestException('This tool version already has a build');
    const stored = await this.buildStorage.storeBuild(file.path, toolId, versionId);
    try { return await this.prisma.toolVersion.update({ where: { id: versionId }, data: { buildPath: stored.buildPath } }); }
    catch (error) { await this.buildStorage.deleteBuild(stored.buildPath); throw error; }
  }

  async adminPublishVersion(toolId: string, versionId: string) {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId }, select: { id: true, slug: true, currentVersionId: true } });
    if (!tool) throw new NotFoundException('Tool not found');
    const version = await this.prisma.toolVersion.findFirst({ where: { id: versionId, toolId } });
    if (!version) throw new NotFoundException('Tool version not found');
    if (version.status !== 'DRAFT' || !version.buildPath) throw new BadRequestException('Upload a build to a draft version before publishing it');
    const promotion = await this.buildStorage.publishBuild(tool.slug, version.buildPath);
    try {
      await this.prisma.$transaction(async (tx) => {
        if (tool.currentVersionId) await tx.toolVersion.updateMany({ where: { id: tool.currentVersionId, toolId, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } });
        await tx.toolVersion.update({ where: { id: versionId }, data: { status: 'PUBLISHED', publishedAt: new Date(), buildPath: tool.slug } });
        await tx.tool.update({ where: { id: toolId }, data: { currentVersionId: versionId } });
      });
      await this.buildStorage.finalizePublishedBuild(promotion);
      return this.adminGetById(toolId);
    } catch (error) { await this.buildStorage.rollbackPublishedBuild(promotion); throw error; }
  }

  async adminArchiveVersion(toolId: string, versionId: string) {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId }, select: { currentVersionId: true } });
    if (!tool) throw new NotFoundException('Tool not found');
    if (tool.currentVersionId === versionId) throw new BadRequestException('Unpublish the tool or publish another version before archiving its current version');
    const version = await this.prisma.toolVersion.findFirst({ where: { id: versionId, toolId } });
    if (!version) throw new NotFoundException('Tool version not found');
    if (version.buildPath?.startsWith('__staged__/')) await this.buildStorage.deleteBuild(version.buildPath);
    return this.prisma.toolVersion.update({ where: { id: versionId }, data: { status: 'ARCHIVED', buildPath: version.buildPath?.startsWith('__staged__/') ? null : version.buildPath } });
  }

  private async assertPublishable(id: string) {
    const tool = await this.prisma.tool.findUnique({ where: { id }, select: { id: true, currentVersionId: true, deletedAt: true } });
    if (!tool) throw new NotFoundException('Tool not found');
    if (tool.deletedAt) throw new BadRequestException('Archived tools cannot be published');
    if (!tool.currentVersionId) throw new BadRequestException('Publish a tool version before publishing the tool');
    const version = await this.prisma.toolVersion.findFirst({ where: { id: tool.currentVersionId, toolId: id, status: 'PUBLISHED' }, select: { buildPath: true } });
    if (!version?.buildPath) throw new BadRequestException('The current tool version has no published build');
  }
  private async ensureTool(id: string) { if (!(await this.prisma.tool.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('Tool not found'); }
  private async validateCommunityIds(ids: string[]) {
    if (!ids.length) return;
    const communities = await this.prisma.community.findMany({ where: { id: { in: ids }, status: 'ACTIVE', deletedAt: null }, select: { id: true } });
    if (communities.length !== new Set(ids).size) throw new BadRequestException('One or more communities are invalid or inactive');
  }
  private publicSelect() { return { id: true, slug: true, title: true, description: true, thumbnailUrl: true, category: true, type: true, currentVersionId: true, createdAt: true, updatedAt: true, communities: { select: { community: { select: { id: true, name: true, slug: true } } } } }; }
  private serialize(tool: any) { return { ...tool, communities: tool.communities.map((x: any) => x.community), launchUrl: tool.currentVersionId ? `${(process.env.TOOL_PUBLIC_URL || 'http://tools.localhost:8080').replace(/\/$/, '')}/${tool.slug}/` : null }; }
}
