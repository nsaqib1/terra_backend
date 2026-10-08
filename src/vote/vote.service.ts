import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';


import { CreateVoteDto } from './dto/create-vote.dto';
import { PrismaService } from 'src/database/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class VoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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

    const result = await this.prisma.$transaction(async (tx) => {
      let notificationId: string | null = null;
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

        if (value === 'UP') {
          const notification = await this.notifications.createInTransaction(tx, {
            recipientId: post.authorId,
            actorId: userId,
            type: 'POST_UPVOTED',
            postId,
          });
          notificationId = notification?.id ?? null;
        }

        return {
          action: 'created',
          value,
          scoreChange,
          notificationId,
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
          notificationId,
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

      if (value === 'UP') {
        const notification = await this.notifications.createInTransaction(tx, {
          recipientId: post.authorId,
          actorId: userId,
          type: 'POST_UPVOTED',
          postId,
        });
        notificationId = notification?.id ?? null;
      }

      return {
        action: 'changed',
        value,
        scoreChange,
        notificationId,
      };
    });

    if (result.notificationId) {
      void this.notifications.emitCreated(result.notificationId);
    }

    const { notificationId: _notificationId, ...response } = result;
    return response;
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

    const result = await this.prisma.$transaction(async (tx) => {
      let notificationId: string | null = null;
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

        if (value === 'UP') {
          const notification = await this.notifications.createInTransaction(tx, {
            recipientId: comment.authorId,
            actorId: userId,
            type: 'COMMENT_UPVOTED',
            postId: comment.postId,
            commentId,
          });
          notificationId = notification?.id ?? null;
        }

        return {
          action: 'created',
          value,
          scoreChange,
          notificationId,
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
          notificationId,
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

      if (value === 'UP') {
        const notification = await this.notifications.createInTransaction(tx, {
          recipientId: comment.authorId,
          actorId: userId,
          type: 'COMMENT_UPVOTED',
          postId: comment.postId,
          commentId,
        });
        notificationId = notification?.id ?? null;
      }

      return {
        action: 'changed',
        value,
        scoreChange,
        notificationId,
      };
    });

    if (result.notificationId) {
      void this.notifications.emitCreated(result.notificationId);
    }

    const { notificationId: _notificationId, ...response } = result;
    return response;
  }

  async getMyVotesForPost(userId: string, postId: string) {
    const postVote = await this.prisma.vote.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
      select: {
        value: true,
      },
    });

    const commentVotes = await this.prisma.vote.findMany({
      where: {
        userId,
        comment: {
          postId,
          deletedAt: null,
        },
      },
      select: {
        commentId: true,
        value: true,
      },
    });

    const commentVotesMap: Record<string, 'UP' | 'DOWN'> = {};
    for (const v of commentVotes) {
      if (v.commentId) {
        commentVotesMap[v.commentId] = v.value;
      }
    }

    return {
      postVote: postVote?.value ?? null,
      commentVotes: commentVotesMap,
    };
  }
}