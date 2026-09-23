import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InviteQueryDto, InviteStatusFilter } from './dto/invite-query.dto';
import { UpdateInviteDto } from './dto/update-invite.dto';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) { }

  /**
   * Check if invite-only signup mode is currently enabled
   */
  isInviteOnlyEnabled(): boolean {
    const flag = this.config.get<string>('INVITE_ONLY_SIGNUP');
    if (flag === undefined || flag === null) {
      return true; // Enabled by default for beta phase
    }
    return flag !== 'false' && flag !== '0';
  }

  /**
   * Generate a secure, readable invite code (e.g. BETA-7K9Q2M)
   */
  generateCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'BETA-';
    const bytes = randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  /**
   * Validate an invite code for frontend verification and signup
   */
  async validateInviteCode(rawCode: string) {
    if (!rawCode || typeof rawCode !== 'string') {
      throw new BadRequestException('Invite code is required');
    }

    const code = rawCode.trim().toUpperCase();

    const invite = await this.prisma.invite.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        label: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        isActive: true,
      },
    });

    if (!invite) {
      throw new NotFoundException('Invalid invite code');
    }

    if (!invite.isActive) {
      throw new BadRequestException('This invite link has been disabled');
    }

    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      throw new BadRequestException('This invite link has expired');
    }

    if (invite.usedCount >= invite.maxUses) {
      throw new BadRequestException(
        'This invite code has reached its maximum redemptions',
      );
    }

    const remainingUses = invite.maxUses - invite.usedCount;

    return {
      valid: true,
      code: invite.code,
      label: invite.label,
      remainingUses,
      expiresAt: invite.expiresAt,
    };
  }

  /**
   * Record usage of an invite code during registration (within transaction)
   */
  async redeemInviteInTransaction(
    rawCode: string,
    userId: string,
    tx: any,
  ) {
    const code = rawCode.trim().toUpperCase();
    const now = new Date();

    const invite = await tx.invite.findUnique({
      where: { code },
    });

    if (!invite) {
      throw new NotFoundException('Invalid invite code');
    }

    if (!invite.isActive) {
      throw new BadRequestException('This invite link has been disabled');
    }

    if (invite.expiresAt && invite.expiresAt < now) {
      throw new BadRequestException('This invite link has expired');
    }

    const updated = await tx.invite.updateMany({
      where: {
        id: invite.id,
        isActive: true,
        usedCount: {
          lt: invite.maxUses,
        },
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: now,
            },
          },
        ],
      },
      data: {
        usedCount: {
          increment: 1,
        },
      },
    });

    if (updated.count !== 1) {
      throw new BadRequestException(
        'This invite code has reached its maximum redemptions',
      );
    }

    await tx.inviteUsage.create({
      data: {
        inviteId: invite.id,
        userId,
      },
    });

    return invite;
  }

  /**
   * Admin: Create a new invite link
   */
  async createInvite(dto: CreateInviteDto, creatorId?: string) {
    let code = dto.code ? dto.code.trim().toUpperCase() : this.generateCode();

    // Check for collision
    const existing = await this.prisma.invite.findUnique({
      where: { code },
    });

    if (existing) {
      if (dto.code) {
        throw new ConflictException('An invite code with this name already exists');
      }
      // If generated had collision, retry once
      code = this.generateCode() + randomBytes(1).toString('hex').toUpperCase();
    }

    const invite = await this.prisma.invite.create({
      data: {
        code,
        label: dto.label?.trim() || null,
        maxUses: dto.maxUses ?? 1,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById: creatorId || null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        usages: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    return invite;
  }

  /**
   * Admin: List all invite codes with usages and filtering
   */
  async listInvites(query: InviteQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    const now = new Date();

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { label: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.status === InviteStatusFilter.ACTIVE) {
      where.isActive = true;
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ];
    } else if (query.status === InviteStatusFilter.INACTIVE) {
      where.isActive = false;
    } else if (query.status === InviteStatusFilter.EXPIRED) {
      where.expiresAt = { lt: now };
    }

    const [total, items] = await Promise.all([
      this.prisma.invite.count({ where }),
      this.prisma.invite.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          usages: {
            orderBy: { usedAt: 'desc' },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Compute status for each invite
    const formattedItems = items.map((invite) => {
      let computedStatus: 'active' | 'inactive' | 'expired' | 'depleted' = 'active';
      if (!invite.isActive) {
        computedStatus = 'inactive';
      } else if (invite.expiresAt && new Date(invite.expiresAt) < now) {
        computedStatus = 'expired';
      } else if (invite.usedCount >= invite.maxUses) {
        computedStatus = 'depleted';
      }

      return {
        ...invite,
        status: computedStatus,
        remainingUses: Math.max(0, invite.maxUses - invite.usedCount),
      };
    });

    const filtered =
      query.status === InviteStatusFilter.DEPLETED
        ? formattedItems.filter((i) => i.status === 'depleted')
        : query.status === InviteStatusFilter.ACTIVE
          ? formattedItems.filter((i) => i.status === 'active')
          : formattedItems;

    return {
      items: filtered,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Get invite metrics and summary stats
   */
  async getInviteStats() {
    const now = new Date();
    const [totalInvites, totalRedemptions, allInvites] = await Promise.all([
      this.prisma.invite.count(),
      this.prisma.inviteUsage.count(),
      this.prisma.invite.findMany({
        select: {
          isActive: true,
          maxUses: true,
          usedCount: true,
          expiresAt: true,
        },
      }),
    ]);

    let activeInvites = 0;
    let totalCapacity = 0;
    let remainingCapacity = 0;

    for (const inv of allInvites) {
      totalCapacity += inv.maxUses;
      const isNotExpired = !inv.expiresAt || new Date(inv.expiresAt) > now;
      const hasUses = inv.usedCount < inv.maxUses;
      if (inv.isActive && isNotExpired && hasUses) {
        activeInvites++;
      }
      if (inv.isActive && isNotExpired) {
        remainingCapacity += Math.max(0, inv.maxUses - inv.usedCount);
      }
    }

    return {
      isInviteOnlyEnabled: this.isInviteOnlyEnabled(),
      totalInvites,
      activeInvites,
      totalRedemptions,
      totalCapacity,
      remainingCapacity,
    };
  }

  /**
   * Admin: Update an invite code
   */
  async updateInvite(id: string, dto: UpdateInviteDto) {
    const invite = await this.prisma.invite.findUnique({
      where: { id },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (dto.maxUses !== undefined && dto.maxUses < invite.usedCount) {
      throw new BadRequestException(
        `Max uses cannot be less than already used count (${invite.usedCount})`,
      );
    }

    const updated = await this.prisma.invite.update({
      where: { id },
      data: {
        label: dto.label !== undefined ? dto.label?.trim() || null : undefined,
        maxUses: dto.maxUses,
        expiresAt:
          dto.expiresAt !== undefined
            ? dto.expiresAt
              ? new Date(dto.expiresAt)
              : null
            : undefined,
        isActive: dto.isActive,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        usages: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    return updated;
  }

  /**
   * Admin: Delete an invite code
   */
  async deleteInvite(id: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { id },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    await this.prisma.invite.delete({
      where: { id },
    });

    return {
      message: 'Invite deleted successfully',
      id,
    };
  }
}
