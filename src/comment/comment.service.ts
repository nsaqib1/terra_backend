import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/database/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ListCommentsDto } from './dto/list-comments.dto';

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) { }

  async create(userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: dto.postId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: {
          id: dto.parentId,
          postId: dto.postId,
          deletedAt: null,
        },
        select: {
          id: true,
          parentId: true,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent comment not found');
      }

      if (parent.parentId) {
        throw new BadRequestException(
          'Replies cannot be nested further',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          postId: dto.postId,
          authorId: userId,
          parentId: dto.parentId ?? null,
          body: dto.body.trim(),
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              points: true,
            },
          },
        },
      });

      await tx.post.update({
        where: {
          id: dto.postId,
        },
        data: {
          commentCount: {
            increment: 1,
          },
        },
      });

      return comment;
    });
  }

  async list(dto: ListCommentsDto) {
    const {
      postId,
      page = 1,
      limit = 20,
      sort = 'newest',
    } = dto;

    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const orderBy =
      sort === 'top'
        ? [{ score: 'desc' as const }, { createdAt: 'asc' as const }]
        : sort === 'oldest'
          ? [{ createdAt: 'asc' as const }]
          : [{ createdAt: 'desc' as const }];

    const where = {
      postId,
      parentId: null,
      deletedAt: null,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,

        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              points: true,
            },
          },

          replies: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              createdAt: 'asc',
            },
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  points: true,
                },
              },
            },
          },
        },
      }),

      this.prisma.comment.count({
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

  async update(
    userId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.prisma.comment.findUnique({
      where: {
        id: commentId,
      },
      select: {
        id: true,
        authorId: true,
        deletedAt: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException(
        'You can only edit your own comments',
      );
    }

    if (comment.deletedAt) {
      throw new BadRequestException(
        'Deleted comments cannot be edited',
      );
    }

    return this.prisma.comment.update({
      where: {
        id: commentId,
      },
      data: {
        body: dto.body.trim(),
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            points: true,
          },
        },
      },
    });
  }

  async remove(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: {
        id: commentId,
      },
      select: {
        id: true,
        authorId: true,
        deletedAt: true,
        postId: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException(
        'You can only delete your own comments',
      );
    }

    if (comment.deletedAt) {
      throw new BadRequestException(
        'Comment has already been deleted',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.comment.update({
        where: {
          id: commentId,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      await tx.post.update({
        where: {
          id: comment.postId,
        },
        data: {
          commentCount: {
            decrement: 1,
          },
        },
      });

      return deleted;
    });
  }
}