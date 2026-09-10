import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProposeCommunityDto } from './dto/propose-community.dto';
import { CommunityMemberQueryDto } from './dto/community-member-query.dto';

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll() {
    return this.prisma.community.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        maturity: true,
        governanceMode: true,
        createdAt: true,
        _count: {
          select: {
            memberships: true,
            posts: true,
          },
        },
      },
    });
  }

  async findJoinedByUser(userId: string) {
    const memberships =
      await this.prisma.communityMembership.findMany({
        where: {
          userId,
          leftAt: null,
          community: {
            status: 'ACTIVE',
            deletedAt: null,
          },
        },
        orderBy: {
          community: {
            name: 'asc',
          },
        },
        select: {
          role: true,
          joinedAt: true,
          community: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

    return memberships.map((membership) => ({
      id: membership.community.id,
      name: membership.community.name,
      slug: membership.community.slug,
      role: membership.role,
      joinedAt: membership.joinedAt,
    }));
  }

  async findBySlug(slug: string) {
    const community = await this.prisma.community.findFirst({
      where: {
        slug: slug.toLowerCase(),
        status: 'ACTIVE',
        deletedAt: null,
      },
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
        _count: {
          select: {
            memberships: true,
            posts: true,
          },
        },
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    return community;
  }

  async join(userId: string, slug: string) {
    const community = await this.prisma.community.findFirst({
      where: {
        slug: slug.toLowerCase(),
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const existingMembership =
      await this.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId,
            communityId: community.id,
          },
        },
      });

    if (existingMembership) {
      if (!existingMembership.leftAt) {
        throw new ConflictException(
          'You are already a citizen of this community',
        );
      }

      const membership =
        await this.prisma.communityMembership.update({
          where: {
            id: existingMembership.id,
          },
          data: {
            leftAt: null,
          },
          select: {
            id: true,
            role: true,
            joinedAt: true,
            leftAt: true,
            community: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

      return membership;
    }

    return this.prisma.communityMembership.create({
      data: {
        userId,
        communityId: community.id,
        role: 'CITIZEN',
      },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        leftAt: true,
        community: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async leave(userId: string, slug: string) {
    const community = await this.prisma.community.findFirst({
      where: {
        slug: slug.toLowerCase(),
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

    const membership =
      await this.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId,
            communityId: community.id,
          },
        },
      });

    if (!membership || membership.leftAt) {
      throw new NotFoundException(
        'You are not a citizen of this community',
      );
    }

    await this.prisma.communityMembership.update({
      where: {
        id: membership.id,
      },
      data: {
        leftAt: new Date(),
      },
    });

    return {
      message: 'You have left the community',
    };
  }

  async getMembership(userId: string, slug: string) {
    const community = await this.prisma.community.findFirst({
      where: {
        slug: slug.toLowerCase(),
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const membership =
      await this.prisma.communityMembership.findUnique({
        where: {
          userId_communityId: {
            userId,
            communityId: community.id,
          },
        },
        select: {
          id: true,
          role: true,
          joinedAt: true,
          leftAt: true,
        },
      });

    if (!membership || membership.leftAt) {
      return {
        isMember: false,
        membership: null,
      };
    }

    return {
      isMember: true,
      membership,
    };
  }

  async getMembers(
    slug: string,
    query: CommunityMemberQueryDto,
  ) {
    const community = await this.prisma.community.findFirst({
      where: {
        slug: slug.toLowerCase(),
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

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      communityId: community.id,
      leftAt: null,
      user: {
        deletedAt: null,
        status: 'ACTIVE' as const,
      },
    };

    const [members, total] = await this.prisma.$transaction([
      this.prisma.communityMembership.findMany({
        where,
        orderBy: {
          joinedAt: 'asc',
        },
        skip,
        take: limit,
        select: {
          id: true,
          role: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              points: true,
            },
          },
        },
      }),

      this.prisma.communityMembership.count({
        where,
      }),
    ]);

    return {
      data: members,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async propose(userId: string, dto: ProposeCommunityDto) {
    const name = dto.name.trim();
    const slug = dto.slug.trim().toLowerCase();
    const description = dto.description.trim();
    const reason = dto.reason.trim();

    const existingCommunity = await this.prisma.community.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (existingCommunity) {
      throw new ConflictException(
        'A community with this slug already exists',
      );
    }

    const existingProposal =
      await this.prisma.communityProposal.findFirst({
        where: {
          proposedSlug: slug,
          status: 'PENDING',
        },
        select: {
          id: true,
        },
      });

    if (existingProposal) {
      throw new ConflictException(
        'A proposal for this community is already under review',
      );
    }

    return this.prisma.communityProposal.create({
      data: {
        proposedName: name,
        proposedSlug: slug,
        description,
        reason,
        proposedById: userId,
      },
      select: {
        id: true,
        proposedName: true,
        proposedSlug: true,
        description: true,
        reason: true,
        status: true,
        createdAt: true,
      },
    });
  }
}