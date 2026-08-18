import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProposeCommunityDto } from './dto/propose-community.dto';

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