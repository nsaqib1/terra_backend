import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AdminCommunityQueryDto } from './dto/admin-community-query.dto';
import { CommunityProposalQueryDto } from './dto/community-proposal-query.dto';
import { CreateCommunityDto } from './dto/create-community.dto';
import { ReviewCommunityProposalDto } from './dto/review-community-proposal.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Summary overview stats for admin dashboard
   */
  async getStats() {
    const [
      totalCommunities,
      activeCommunities,
      inactiveCommunities,
      archivedCommunities,
      pendingProposals,
      totalCitizens,
      totalPosts,
    ] = await Promise.all([
      this.prisma.community.count({ where: { deletedAt: null } }),
      this.prisma.community.count({
        where: { status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.community.count({
        where: { status: 'INACTIVE', deletedAt: null },
      }),
      this.prisma.community.count({
        where: {
          OR: [{ status: 'ARCHIVED' }, { deletedAt: { not: null } }],
        },
      }),
      this.prisma.communityProposal.count({ where: { status: 'PENDING' } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.post.count({ where: { deletedAt: null } }),
    ]);

    return {
      communities: {
        total: totalCommunities,
        active: activeCommunities,
        inactive: inactiveCommunities,
        archived: archivedCommunities,
      },
      proposals: {
        pending: pendingProposals,
      },
      platform: {
        totalCitizens,
        totalPosts,
      },
    };
  }

  /**
   * Paginated list of communities with search and filters for admin
   */
  async getCommunities(query: AdminCommunityQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.maturity) {
      where.maturity = query.maturity;
    }

    if (query.governanceMode) {
      where.governanceMode = query.governanceMode;
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Determine sorting
    let orderBy: any = { createdAt: query.sortOrder ?? 'desc' };
    if (query.sortBy === 'name') {
      orderBy = { name: query.sortOrder ?? 'asc' };
    }

    const [communities, total] = await this.prisma.$transaction([
      this.prisma.community.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          status: true,
          maturity: true,
          governanceMode: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          _count: {
            select: {
              memberships: true,
              posts: true,
              tags: true,
            },
          },
        },
      }),
      this.prisma.community.count({ where }),
    ]);

    return {
      data: communities.map((c) => ({
        ...c,
        membersCount: c._count.memberships,
        postsCount: c._count.posts,
        tagsCount: c._count.tags,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single community details with metrics and tags
   */
  async getCommunityById(id: string) {
    const community = await this.prisma.community.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            memberships: true,
            posts: true,
            tags: true,
            proposals: true,
          },
        },
        tags: {
          take: 10,
          orderBy: { usageCount: 'desc' },
        },
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    return {
      ...community,
      membersCount: community._count.memberships,
      postsCount: community._count.posts,
      tagsCount: community._count.tags,
      proposalsCount: community._count.proposals,
    };
  }

  /**
   * Create a new community directly by Admin
   */
  async createCommunity(dto: CreateCommunityDto) {
    const slug = dto.slug.trim().toLowerCase();

    const existing = await this.prisma.community.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException('A community with this slug already exists');
    }

    return this.prisma.community.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        status: dto.status ?? 'ACTIVE',
        maturity: dto.maturity ?? 'NEW',
        governanceMode: dto.governanceMode ?? 'PLATFORM_MANAGED',
      },
    });
  }

  /**
   * Update an existing community
   */
  async updateCommunity(id: string, dto: UpdateCommunityDto) {
    const existing = await this.prisma.community.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Community not found');
    }

    if (dto.slug) {
      const slug = dto.slug.trim().toLowerCase();
      if (slug !== existing.slug) {
        const slugExists = await this.prisma.community.findUnique({
          where: { slug },
        });

        if (slugExists) {
          throw new ConflictException('A community with this slug already exists');
        }
      }
    }

    return this.prisma.community.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        slug: dto.slug ? dto.slug.trim().toLowerCase() : undefined,
        description:
          dto.description !== undefined
            ? dto.description?.trim() || null
            : undefined,
        status: dto.status,
        maturity: dto.maturity,
        governanceMode: dto.governanceMode,
      },
    });
  }

  /**
   * Soft-delete or archive a community
   */
  async deleteCommunity(id: string) {
    const existing = await this.prisma.community.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Community not found');
    }

    return this.prisma.community.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Proposals management
   */
  async getCommunityProposals(query: CommunityProposalQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      ...(query.status
        ? {
          status: query.status,
        }
        : {}),
    };

    const [proposals, total] = await this.prisma.$transaction([
      this.prisma.communityProposal.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        select: {
          id: true,
          proposedName: true,
          proposedSlug: true,
          description: true,
          reason: true,
          status: true,
          reviewReason: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          proposedBy: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          community: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      this.prisma.communityProposal.count({
        where,
      }),
    ]);

    return {
      data: proposals,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async reviewCommunityProposal(
    adminUserId: string,
    proposalId: string,
    dto: ReviewCommunityProposalDto,
  ) {
    const proposal = await this.prisma.communityProposal.findUnique({
      where: {
        id: proposalId,
      },
      include: {
        proposedBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException('Community proposal not found');
    }

    if (proposal.status !== 'PENDING') {
      throw new BadRequestException('This proposal has already been reviewed');
    }

    if (dto.status === 'REJECTED' && !dto.reviewReason?.trim()) {
      throw new BadRequestException('A rejection reason is required');
    }

    if (dto.status === 'REJECTED') {
      return this.prisma.communityProposal.update({
        where: {
          id: proposal.id,
        },
        data: {
          status: 'REJECTED',
          reviewedById: adminUserId,
          reviewReason: dto.reviewReason?.trim(),
          reviewedAt: new Date(),
        },
      });
    }

    return this.approveCommunityProposal(
      adminUserId,
      proposal,
      dto.reviewReason,
    );
  }

  private async approveCommunityProposal(
    adminUserId: string,
    proposal: any,
    reviewReason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existingCommunity = await tx.community.findUnique({
        where: {
          slug: proposal.proposedSlug,
        },
      });

      if (existingCommunity) {
        throw new BadRequestException(
          'A community with this slug already exists',
        );
      }

      const community = await tx.community.create({
        data: {
          name: proposal.proposedName,
          slug: proposal.proposedSlug,
          description: proposal.description,
          status: 'ACTIVE',
          maturity: 'NEW',
          governanceMode: 'PLATFORM_MANAGED',
        },
      });

      await tx.communityMembership.create({
        data: {
          userId: proposal.proposedById,
          communityId: community.id,
          role: 'CITIZEN',
        },
      });

      const updatedProposal = await tx.communityProposal.update({
        where: {
          id: proposal.id,
        },
        data: {
          status: 'APPROVED',
          reviewedById: adminUserId,
          reviewReason: reviewReason?.trim(),
          reviewedAt: new Date(),
          communityId: community.id,
        },
      });

      return {
        community,
        proposal: updatedProposal,
      };
    });
  }
}