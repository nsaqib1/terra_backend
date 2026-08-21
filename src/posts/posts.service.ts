import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';


import { PrismaService } from 'src/database/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';

import { validatePostDocument } from './schemas/post-document.validation';

import {
  extractPostMediaIds,
  extractPostSearchText,
} from './schemas/post-document.utils';


@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async create(
    userId: string,
    dto: CreatePostDto,
  ) {
    const community =
      await this.prisma.community.findFirst({
        where: {
          id: dto.communityId,
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
      throw new NotFoundException(
        'Community not found',
      );
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
          leftAt: true,
          role: true,
        },
      });

    if (!membership || membership.leftAt) {
      throw new ForbiddenException(
        'You must be a citizen of this community to create a post',
      );
    }

    const document =
      validatePostDocument(dto.document);

    const mediaIds =
      extractPostMediaIds(document);

    if (mediaIds.length > 0) {
      const media =
        await this.prisma.media.findMany({
          where: {
            id: {
              in: mediaIds,
            },
            uploadedById: userId,
            status: 'ACTIVE',
            deletedAt: null,
            postId: null,
          },
          select: {
            id: true,
          },
        });

      const foundMediaIds = new Set(
        media.map((item) => item.id),
      );

      const invalidMediaIds =
        mediaIds.filter(
          (id) => !foundMediaIds.has(id),
        );

      if (invalidMediaIds.length > 0) {
        throw new ConflictException(
          'One or more media files cannot be attached to this post',
        );
      }
    }

    const hashtagIds = [
      ...new Set(dto.hashtagIds),
    ];

    if (hashtagIds.length > 0) {
      const hashtags =
        await this.prisma.hashtag.findMany({
          where: {
            id: {
              in: hashtagIds,
            },
            communityId: community.id,
            status: 'ACTIVE',
          },
          select: {
            id: true,
          },
        });

      const foundHashtagIds =
        new Set(
          hashtags.map(
            (hashtag) => hashtag.id,
          ),
        );

      const invalidHashtagIds =
        hashtagIds.filter(
          (id) =>
            !foundHashtagIds.has(id),
        );

      if (invalidHashtagIds.length > 0) {
        throw new ConflictException(
          'One or more hashtags do not belong to this community',
        );
      }
    }

    const searchText =
      extractPostSearchText(document);

    const post =
      await this.prisma.$transaction(
        async (tx) => {
          const createdPost =
            await tx.post.create({
              data: {
                communityId:
                  community.id,

                authorId: userId,

                document,

                searchText,

                hashtags: {
                  create:
                    hashtagIds.map(
                      (hashtagId) => ({
                        hashtagId,
                      }),
                    ),
                },
              },

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

                hashtags: {
                  select: {
                    hashtag: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                      },
                    },
                  },
                },
              },
            });

          if (mediaIds.length > 0) {
            await tx.media.updateMany({
              where: {
                id: {
                  in: mediaIds,
                },
                uploadedById: userId,
                postId: null,
              },

              data: {
                postId:
                  createdPost.id,
              },
            });
          }

          return createdPost;
        },
      );

    return {
      id: post.id,
      document: post.document,

      community: post.community,

      author: post.author,

      hashtags:
        post.hashtags.map(
          (item) => item.hashtag,
        ),

      score: post.score,

      commentCount:
        post.commentCount,

      status: post.status,

      createdAt:
        post.createdAt,

      updatedAt:
        post.updatedAt,
    };
  }
}