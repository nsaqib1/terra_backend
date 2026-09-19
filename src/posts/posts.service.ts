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
    // -----------------------------------------
    // Find community
    // -----------------------------------------

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

    // -----------------------------------------
    // Verify community membership
    // -----------------------------------------

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

    // -----------------------------------------
    // Validate document
    // -----------------------------------------

    const document =
      validatePostDocument(dto.document);

    // -----------------------------------------
    // Extract media IDs from document
    // -----------------------------------------

    const mediaIds =
      extractPostMediaIds(document);

    // -----------------------------------------
    // Validate media ownership/status
    // -----------------------------------------

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

      if (invalidMediaIds.length > 0) {
        throw new ConflictException(
          'One or more media files are invalid or unavailable',
        );
      }
    }

    // -----------------------------------------
    // Prepare tag IDs
    // -----------------------------------------

    const tagIds = [
      ...new Set(dto.tagIds),
    ];

    // -----------------------------------------
    // Validate tags
    // -----------------------------------------

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

      const validTagIds =
        new Set(
          tags.map(
            (tag) => tag.id,
          ),
        );

      const invalidTagIds =
        tagIds.filter(
          (id) =>
            !validTagIds.has(id),
        );

      if (invalidTagIds.length > 0) {
        throw new ConflictException(
          'One or more tags do not belong to this community',
        );
      }
    }

    // -----------------------------------------
    // Extract searchable text
    // -----------------------------------------

    const searchText =
      extractPostSearchText(document);

    // -----------------------------------------
    // Create post transaction
    // -----------------------------------------

    const post =
      await this.prisma.$transaction(
        async (tx) => {
          // -----------------------------------
          // Create post
          // -----------------------------------

          const createdPost =
            await tx.post.create({
              data: {
                communityId:
                  community.id,

                authorId:
                  userId,

                document,

                searchText,
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

          // -----------------------------------
          // Create PostTag relationships
          // -----------------------------------

          if (tagIds.length > 0) {
            await tx.postTag.createMany({
              data: tagIds.map(
                (tagId) => ({
                  postId:
                    createdPost.id,

                  tagId,
                }),
              ),
            });

            // ---------------------------------
            // Increase tag usage counts
            // ---------------------------------

            await Promise.all(
              tagIds.map(
                (tagId) =>
                  tx.tag.update({
                    where: {
                      id: tagId,
                    },

                    data: {
                      usageCount: {
                        increment: 1,
                      },
                    },
                  }),
              ),
            );
          }

          // -----------------------------------
          // Attach media to post
          // -----------------------------------

          if (mediaIds.length > 0) {
            await tx.media.updateMany({
              where: {
                id: {
                  in: mediaIds,
                },

                uploadedById: userId,

                status: 'TEMPORARY',

                deletedAt: null,
              },

              data: {
                postId:
                  createdPost.id,

                status: 'ACTIVE',
              },
            });
          }

          return createdPost;
        },
      );

    // -----------------------------------------
    // Return API response
    // -----------------------------------------

    return {
      id: post.id,

      document: post.document,

      community: post.community,

      author: post.author,

      tags: post.tags.map(
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

  async findMany(query: GetPostsQueryDto, userId?: string) {
    const { communityId, page, limit, sort = 'newest' } = query;

    const skip = (page - 1) * limit;

    const where: any = {
      status: 'ACTIVE',
      deletedAt: null,
    };

    if (communityId) {
      where.communityId = communityId;
    } else if (userId) {
      const memberships = await this.prisma.communityMembership.findMany({
        where: {
          userId,
          leftAt: null,
        },
        select: {
          communityId: true,
        },
      });

      const joinedCommunityIds = memberships.map((m) => m.communityId);

      where.communityId = {
        in: joinedCommunityIds,
      };
    }

    let orderBy: any = [{ createdAt: 'desc' }];
    if (sort === 'top' || sort === 'score' || sort === 'popular') {
      orderBy = [{ score: 'desc' }, { createdAt: 'desc' }];
    } else if (sort === 'comments' || sort === 'most_discussed') {
      orderBy = [{ commentCount: 'desc' }, { createdAt: 'desc' }];
    } else if (sort === 'oldest') {
      orderBy = [{ createdAt: 'asc' }];
    } else {
      orderBy = [{ createdAt: 'desc' }];
    }

    const [posts, total] =
      await this.prisma.$transaction([
        this.prisma.post.findMany({
          where,
          orderBy,
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

  /**
   * Trending posts algorithm.
   *
   * Scoring formula (Hacker News-inspired with time decay):
   *   trendingScore = (score * 1.5 + commentCount * 2.5) / (ageHours + 2)^1.8
   *
   * - score        weighted x1.5  (upvote / downvote net)
   * - commentCount weighted x2.5  (engagement signal)
   * - ageHours     hours since creation
   * - gravity 1.8  (higher = faster decay, keeps feed fresh)
   *
   * Only considers posts from the last `windowHours` hours (default 72h).
   */
  async getTrending(limit = 5, windowHours = 72) {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const posts = await this.prisma.post.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        createdAt: { gte: since },
      },

      select: {
        id: true,
        document: true,
        score: true,
        commentCount: true,
        createdAt: true,

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

    const now = Date.now();
    const gravity = 1.8;

    const scored = posts.map((post) => {
      const ageHours = (now - post.createdAt.getTime()) / (1000 * 60 * 60);
      const trendingScore =
        (post.score * 1.5 + post.commentCount * 2.5) /
        Math.pow(ageHours + 2, gravity);

      return { ...post, trendingScore };
    });

    scored.sort((a, b) => b.trendingScore - a.trendingScore);

    return scored.slice(0, limit).map((post) => ({
      id: post.id,
      document: post.document,
      community: post.community,
      author: post.author,
      tags: post.tags.map((t) => t.tag),
      score: post.score,
      commentCount: post.commentCount,
      createdAt: post.createdAt,
      trendingScore: post.trendingScore,
    }));
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
        tags: {
          select: {
            tagId: true,
          },
        },
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

    // -----------------------------------------
    // Validate document if it was provided
    // -----------------------------------------

    let document;
    let searchText;

    if (dto.document !== undefined) {
      document = validatePostDocument(dto.document);

      searchText = extractPostSearchText(document);
    }

    // -----------------------------------------
    // Prepare and validate tags if provided
    // -----------------------------------------

    let tagIds: string[] | undefined;

    if (dto.tagIds !== undefined) {
      // Remove duplicate tag IDs
      tagIds = [...new Set(dto.tagIds)];

      if (tagIds.length > 0) {
        const tags = await this.prisma.tag.findMany({
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
          tags.map((tag) => tag.id),
        );

        const invalidIds = tagIds.filter(
          (id) => !validIds.has(id),
        );

        if (invalidIds.length > 0) {
          throw new ConflictException(
            'One or more tags do not belong to this community',
          );
        }
      }
    }

    // -----------------------------------------
    // Update post + tags in one transaction
    // -----------------------------------------

    const updatedPost =
      await this.prisma.$transaction(
        async (tx) => {
          // -----------------------------------
          // Calculate tag changes
          // -----------------------------------

          let addedTagIds: string[] = [];
          let removedTagIds: string[] = [];

          if (tagIds !== undefined) {
            const oldTagIds = new Set(
              post.tags.map((tag) => tag.tagId),
            );

            const newTagIds = new Set(tagIds);

            // Tags that are newly added
            addedTagIds = tagIds.filter(
              (tagId) => !oldTagIds.has(tagId),
            );

            // Tags that were removed
            removedTagIds = post.tags
              .map((tag) => tag.tagId)
              .filter(
                (tagId) => !newTagIds.has(tagId),
              );
          }

          // -----------------------------------
          // Update the Post
          // -----------------------------------

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

          // -----------------------------------
          // Decrease usage count for removed tags
          // -----------------------------------

          if (removedTagIds.length > 0) {
            await Promise.all(
              removedTagIds.map((tagId) =>
                tx.tag.update({
                  where: {
                    id: tagId,
                  },
                  data: {
                    usageCount: {
                      decrement: 1,
                    },
                  },
                }),
              ),
            );
          }

          // -----------------------------------
          // Increase usage count for added tags
          // -----------------------------------

          if (addedTagIds.length > 0) {
            await Promise.all(
              addedTagIds.map((tagId) =>
                tx.tag.update({
                  where: {
                    id: tagId,
                  },
                  data: {
                    usageCount: {
                      increment: 1,
                    },
                  },
                }),
              ),
            );
          }

          return updated;
        },
      );

    // -----------------------------------------
    // Return API response
    // -----------------------------------------

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

        tags: {
          select: {
            tagId: true,
          },
        },
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

    if (post.status === 'REMOVED') {
      throw new ConflictException(
        'Post has already been removed',
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        // -----------------------------------
        // Remove the post
        // -----------------------------------

        await tx.post.update({
          where: {
            id: post.id,
          },

          data: {
            status: 'REMOVED',
            deletedAt: new Date(),
          },
        });

        // -----------------------------------
        // Decrease tag usage counts
        // -----------------------------------

        if (post.tags.length > 0) {
          await Promise.all(
            post.tags.map((tag) =>
              tx.tag.update({
                where: {
                  id: tag.tagId,
                },

                data: {
                  usageCount: {
                    decrement: 1,
                  },
                },
              }),
            ),
          );
        }
      },
    );

    return {
      message: 'Post removed successfully',
    };
  }
}