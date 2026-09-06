import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';


import { CreateVoteDto } from './dto/create-vote.dto';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class VoteService {
  constructor(private readonly prisma: PrismaService) { }

  async vote(userId: string, dto: CreateVoteDto) {
    if (!dto.postId && !dto.commentId) {
      throw new BadRequestException(
        'Either postId or commentId is required',
      );
    }

    if (dto.postId && dto.commentId) {
      throw new BadRequestException(
        'Only one of postId or commentId can be provided',
      );
    }

    if (dto.postId) {
      return this.votePost(userId, dto.postId, dto.value);
    }

    return this.voteComment(
      userId,
      dto.commentId!,
      dto.value,
    );
  }

  private async votePost(
    userId: string,
    postId: string,
    value: 'UP' | 'DOWN',
  ) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const existingVote = await tx.vote.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });

      // No existing vote → create it
      if (!existingVote) {
        await tx.vote.create({
          data: {
            userId,
            postId,
            value,
          },
        });

        const scoreChange = value === 'UP' ? 1 : -1;

        await tx.post.update({
          where: {
            id: postId,
          },
          data: {
            score: {
              increment: scoreChange,
            },
          },
        });

        return {
          action: 'created',
          value,
          scoreChange,
        };
      }

      // Same vote → remove it
      if (existingVote.value === value) {
        await tx.vote.delete({
          where: {
            id: existingVote.id,
          },
        });

        const scoreChange = value === 'UP' ? -1 : 1;

        await tx.post.update({
          where: {
            id: postId,
          },
          data: {
            score: {
              increment: scoreChange,
            },
          },
        });

        return {
          action: 'removed',
          value: null,
          scoreChange,
        };
      }

      // Different vote → switch it
      await tx.vote.update({
        where: {
          id: existingVote.id,
        },
        data: {
          value,
        },
      });

      const scoreChange = value === 'UP' ? 2 : -2;

      await tx.post.update({
        where: {
          id: postId,
        },
        data: {
          score: {
            increment: scoreChange,
          },
        },
      });

      return {
        action: 'changed',
        value,
        scoreChange,
      };
    });
  }

  private async voteComment(
    userId: string,
    commentId: string,
    value: 'UP' | 'DOWN',
  ) {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id: commentId,
        deletedAt: null,
      },
      select: {
        id: true,
        postId: true,
        authorId: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const existingVote = await tx.vote.findUnique({
        where: {
          userId_commentId: {
            userId,
            commentId,
          },
        },
      });

      // No existing vote → create
      if (!existingVote) {
        await tx.vote.create({
          data: {
            userId,
            commentId,
            value,
          },
        });

        const scoreChange = value === 'UP' ? 1 : -1;

        await tx.comment.update({
          where: {
            id: commentId,
          },
          data: {
            score: {
              increment: scoreChange,
            },
          },
        });

        return {
          action: 'created',
          value,
          scoreChange,
        };
      }

      // Same vote → remove
      if (existingVote.value === value) {
        await tx.vote.delete({
          where: {
            id: existingVote.id,
          },
        });

        const scoreChange = value === 'UP' ? -1 : 1;

        await tx.comment.update({
          where: {
            id: commentId,
          },
          data: {
            score: {
              increment: scoreChange,
            },
          },
        });

        return {
          action: 'removed',
          value: null,
          scoreChange,
        };
      }

      // Different vote → switch
      await tx.vote.update({
        where: {
          id: existingVote.id,
        },
        data: {
          value,
        },
      });

      const scoreChange = value === 'UP' ? 2 : -2;

      await tx.comment.update({
        where: {
          id: commentId,
        },
        data: {
          score: {
            increment: scoreChange,
          },
        },
      });

      return {
        action: 'changed',
        value,
        scoreChange,
      };
    });
  }
}