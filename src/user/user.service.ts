import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserPostsQueryDto } from './dto/user-posts-query.dto';
import { UserCommunitiesQueryDto } from './dto/user-communities-query.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) { }

  async getProfile(userId: string) {
    const [user, postCount, communityCount, postUpvotes, commentUpvotes] =
      await this.prisma.$transaction([
        this.prisma.user.findFirst({
          where: {
            id: userId,
            status: 'ACTIVE',
            deletedAt: null,
          },
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            location: true,
            website: true,
            points: true,
            createdAt: true,
          },
        }),
        this.prisma.post.count({
          where: {
            authorId: userId,
            status: 'ACTIVE',
            deletedAt: null,
          },
        }),
        this.prisma.communityMembership.count({
          where: {
            userId,
            leftAt: null,
            community: {
              status: 'ACTIVE',
              deletedAt: null,
            },
          },
        }),
        this.prisma.vote.count({
          where: {
            value: 'UP',
            post: {
              authorId: userId,
              status: 'ACTIVE',
              deletedAt: null,
            },
          },
        }),
        this.prisma.vote.count({
          where: {
            value: 'UP',
            comment: {
              authorId: userId,
              deletedAt: null,
              post: {
                status: 'ACTIVE',
                deletedAt: null,
              },
            },
          },
        }),
      ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      user,
      stats: {
        posts: postCount,
        upvotes: postUpvotes + commentUpvotes,
        communities: communityCount,
      },
    };
  }

  async getUserPosts(userId: string, query: UserPostsQueryDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = {
      authorId: userId,
      status: 'ACTIVE' as const,
      deletedAt: null,
    };

    const [posts, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        select: {
          id: true,
          document: true,
          score: true,
          commentCount: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          community: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          tags: {
            select: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          media: {
            where: {
              status: 'ACTIVE',
              deletedAt: null,
            },
            select: {
              id: true,
              type: true,
              storageKey: true,
              mimeType: true,
              width: true,
              height: true,
              size: true,
              altText: true,
            },
          },
        },
      }),
      this.prisma.post.count({
        where,
      }),
    ]);

    return {
      data: posts.map((post) => ({
        id: post.id,
        document: post.document,
        community: post.community,
        author: post.author,
        tags: post.tags.map((item) => item.tag),
        media: post.media,
        score: post.score,
        commentCount: post.commentCount,
        status: post.status,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserCommunities(userId: string, query: UserCommunitiesQueryDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      leftAt: null,
      community: {
        status: 'ACTIVE' as const,
        deletedAt: null,
      },
    };

    const [memberships, total] = await this.prisma.$transaction([
      this.prisma.communityMembership.findMany({
        where,
        orderBy: {
          community: {
            name: 'asc',
          },
        },
        skip,
        take: limit,
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
      }),
      this.prisma.communityMembership.count({
        where,
      }),
    ]);

    return {
      data: memberships.map((membership) => ({
        id: membership.community.id,
        name: membership.community.name,
        slug: membership.community.slug,
        role: membership.role,
        joinedAt: membership.joinedAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (dto.username && dto.username !== existingUser.username) {
      const conflict = await this.prisma.user.findFirst({
        where: {
          username: dto.username,
          id: {
            not: userId,
          },
        },
        select: {
          id: true,
        },
      });

      if (conflict) {
        throw new ConflictException('Username is already taken');
      }
    }

    if (dto.avatarUrl) {
      const match = dto.avatarUrl.match(/\/media\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        await this.prisma.media.updateMany({
          where: {
            id: match[1],
            uploadedById: userId,
          },
          data: {
            status: 'ACTIVE',
          },
        });
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        ...(dto.displayName !== undefined && {
          displayName: dto.displayName,
        }),
        ...(dto.username !== undefined && {
          username: dto.username,
        }),
        ...(dto.bio !== undefined && {
          bio: dto.bio,
        }),
        ...(dto.location !== undefined && {
          location: dto.location,
        }),
        ...(dto.website !== undefined && {
          website: dto.website,
        }),
        ...(dto.avatarUrl !== undefined && {
          avatarUrl: dto.avatarUrl,
        }),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        location: true,
        website: true,
        points: true,
        createdAt: true,
      },
    });

    return {
      user: updatedUser,
    };
  }
}
