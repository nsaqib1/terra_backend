import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { UpdatePostDto } from './dto/update-post.dto';


import { PrismaService } from 'src/database/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';

import { validatePostDocument } from './schemas/post-document.validation';

import {
  extractPostMediaIds,
  extractPostSearchText,
} from './schemas/post-document.utils';
import { GetPostsQueryDto } from './dto/get-post-query.dto';
import { extractMediaIds } from './utils/extract-media-ids';


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

    const document = validatePostDocument(dto.document);

    const mediaIds = extractPostMediaIds(document);

    if (mediaIds.length > 0) {
      const media =
        await this.prisma.media.findMany({
          where: {
            id: {
              in: mediaIds,
            },

            uploadedById: userId,

            status: 'TEMPORARY',

            deletedAt: null,
          },

          select: {
            id: true,
          },
        });

      const validMediaIds =
        new Set(
          media.map(
            (item) => item.id,
          ),
        );

      const invalidMediaIds =
        mediaIds.filter(
          (id) =>
            !validMediaIds.has(id),
        );

      if (
        invalidMediaIds.length > 0
      ) {
        throw new ConflictException(
          'One or more media files are invalid or unavailable',
        );
      }
    }

    const tagIds = [
      ...new Set(dto.tagIds),
    ];

    if (tagIds.length > 0) {
      const tags =
        await this.prisma.tag.findMany({
          where: {
            id: {
              in: tagIds,
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
          tags.map(
            (hashtag) => hashtag.id,
          ),
        );

      const invalidTagIds =
        tagIds.filter(
          (id) =>
            !foundHashtagIds.has(id),
        );

      if (invalidTagIds.length > 0) {
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

                tags: {
                  create:
                    tagIds.map(
                      (tagId) => ({
                        tagId,
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
              },
            });

          if (mediaIds.length > 0) {
            await tx.media.updateMany({
              where: {
                id: {
                  in: mediaIds,
                },

                uploadedById: userId,

                status: 'TEMPORARY',
              },

              data: {
                postId: createdPost.id,
                status: 'ACTIVE',
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

      tags:
        post.tags.map(
          (item) => item.tag,
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

  async findOne(postId: string) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: 'ACTIVE',
        deletedAt: null,
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
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return {
      id: post.id,

      document: post.document,

      community: post.community,

      author: post.author,

      tags: post.tags.map(
        (item) => item.tag,
      ),

      media: post.media,

      score: post.score,

      commentCount: post.commentCount,

      status: post.status,

      createdAt: post.createdAt,

      updatedAt: post.updatedAt,
    };
  }

  async findMany(query: GetPostsQueryDto) {
    const { communityId, page, limit } = query;

    const skip = (page - 1) * limit;

    const [posts, total] =
      await this.prisma.$transaction([
        this.prisma.post.findMany({
          where: {
            communityId,
            status: 'ACTIVE',
            deletedAt: null,
          },

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
          where: {
            communityId,
            status: 'ACTIVE',
            deletedAt: null,
          },
        }),
      ]);

    return {
      data: posts.map((post) => ({
        id: post.id,

        document: post.document,

        community: post.community,

        author: post.author,

        tags: post.tags.map(
          (item) => item.tag,
        ),

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
        hasNextPage:
          page * limit < total,
      },
    };
  }

  async update(
    userId: string,
    postId: string,
    dto: UpdatePostDto,
  ) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
      },
      select: {
        id: true,
        authorId: true,
        communityId: true,
        status: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'You can only edit your own posts',
      );
    }

    if (post.status === 'REMOVED') {
      throw new ConflictException(
        'Removed posts cannot be edited',
      );
    }

    let document;
    let searchText;

    if (dto.document !== undefined) {
      document = validatePostDocument(dto.document);

      searchText =
        extractPostSearchText(document);
    }

    let tagIds: string[] | undefined;

    if (dto.tagIds !== undefined) {
      tagIds = [
        ...new Set(dto.tagIds),
      ];

      if (tagIds.length > 0) {
        const tags =
          await this.prisma.tag.findMany({
            where: {
              id: {
                in: tagIds,
              },
              communityId: post.communityId,
              status: 'ACTIVE',
            },
            select: {
              id: true,
            },
          });

        const validIds = new Set(
          tags.map((item) => item.id),
        );

        const invalidIds =
          tagIds.filter(
            (id) => !validIds.has(id),
          );

        if (invalidIds.length > 0) {
          throw new ConflictException(
            'One or more hashtags do not belong to this community',
          );
        }
      }
    }

    const updatedPost =
      await this.prisma.$transaction(
        async (tx) => {
          const updated =
            await tx.post.update({
              where: {
                id: post.id,
              },

              data: {
                ...(document !== undefined && {
                  document,
                  searchText,
                }),

                ...(tagIds !== undefined && {
                  tags: {
                    deleteMany: {},

                    create: tagIds.map(
                      (tagId) => ({
                        tagId,
                      }),
                    ),
                  },
                }),
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
            });

          return updated;
        },
      );

    return {
      id: updatedPost.id,
      document: updatedPost.document,
      community: updatedPost.community,
      author: updatedPost.author,

      tags: updatedPost.tags.map(
        (item) => item.tag,
      ),

      media: updatedPost.media,

      score: updatedPost.score,
      commentCount:
        updatedPost.commentCount,

      status: updatedPost.status,

      createdAt:
        updatedPost.createdAt,

      updatedAt:
        updatedPost.updatedAt,
    };
  }

  async remove(
    userId: string,
    postId: string,
  ) {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
      },

      select: {
        id: true,
        authorId: true,
        status: true,
      },
    });

    if (!post) {
      throw new NotFoundException(
        'Post not found',
      );
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'You can only remove your own posts',
      );
    }

    await this.prisma.post.update({
      where: {
        id: post.id,
      },

      data: {
        status: 'REMOVED',
        deletedAt: new Date(),
      },
    });

    return {
      message: 'Post removed successfully',
    };
  }
}