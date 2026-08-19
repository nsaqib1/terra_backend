import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ReviewCommunityProposalDto } from './dto/review-community-proposal.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async reviewCommunityProposal(
    adminUserId: string,
    proposalId: string,
    dto: ReviewCommunityProposalDto,
  ) {
    const proposal =
      await this.prisma.communityProposal.findUnique({
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
      throw new NotFoundException(
        'Community proposal not found',
      );
    }

    if (proposal.status !== 'PENDING') {
      throw new BadRequestException(
        'This proposal has already been reviewed',
      );
    }

    if (
      dto.status === 'REJECTED' &&
      !dto.reviewReason?.trim()
    ) {
      throw new BadRequestException(
        'A rejection reason is required',
      );
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
      const existingCommunity =
        await tx.community.findUnique({
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

      const updatedProposal =
        await tx.communityProposal.update({
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