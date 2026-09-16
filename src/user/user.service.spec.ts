import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../database/prisma.service';

describe('UserService', () => {
  let service: UserService;
  let prisma: {
    $transaction: jest.Mock;
    user: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    post: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    communityMembership: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    vote: {
      count: jest.Mock;
    };
  };

  const mockUser = {
    id: 'user-uuid-1',
    username: 'janedoe',
    displayName: 'Jane Doe',
    avatarUrl: null,
    bio: 'Community builder...',
    location: 'Austin, TX',
    website: 'https://janedoe.dev',
    points: 1240,
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      post: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      communityMembership: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      vote: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('getProfile', () => {
    it('should return user profile and statistics', async () => {
      prisma.$transaction.mockResolvedValue([
        mockUser,
        38, // postCount
        6,  // communityCount
        300, // postUpvotes
        112, // commentUpvotes
      ]);

      const result = await service.getProfile('user-uuid-1');

      expect(result).toEqual({
        user: mockUser,
        stats: {
          posts: 38,
          upvotes: 412,
          communities: 6,
        },
      });
    });

    it('should throw NotFoundException if user is not found or inactive', async () => {
      prisma.$transaction.mockResolvedValue([
        null,
        0,
        0,
        0,
        0,
      ]);

      await expect(service.getProfile('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserPosts', () => {
    it('should return paginated posts for active user', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-uuid-1' });

      const mockPosts = [
        {
          id: 'post-1',
          document: { type: 'doc', content: [] },
          score: 10,
          commentCount: 2,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          community: { id: 'c1', name: 'Civic Tech', slug: 'civic-tech' },
          author: {
            id: 'user-uuid-1',
            username: 'janedoe',
            displayName: 'Jane Doe',
            avatarUrl: null,
          },
          tags: [{ tag: { id: 't1', name: 'Tech', slug: 'tech' } }],
          media: [
            {
              id: 'm1',
              type: 'IMAGE',
              storageKey: 'key1',
              mimeType: 'image/png',
              width: 100,
              height: 100,
              size: 5000,
              altText: 'Alt',
            },
          ],
        },
      ];

      prisma.$transaction.mockResolvedValue([mockPosts, 1]);

      const result = await service.getUserPosts('user-uuid-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('post-1');
      expect(result.data[0].tags).toEqual([
        { id: 't1', name: 'Tech', slug: 'tech' },
      ]);
      expect(result.data[0].media).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.getUserPosts('non-existent-id', { page: 1, limit: 10 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserCommunities', () => {
    it('should return paginated user communities', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-uuid-1' });

      const mockMemberships = [
        {
          role: 'CITIZEN',
          joinedAt: new Date('2026-08-01T12:00:00.000Z'),
          community: {
            id: 'c1',
            name: 'Civic Tech',
            slug: 'civic-tech',
          },
        },
      ];

      prisma.$transaction.mockResolvedValue([mockMemberships, 1]);

      const result = await service.getUserCommunities('user-uuid-1', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual([
        {
          id: 'c1',
          name: 'Civic Tech',
          slug: 'civic-tech',
          role: 'CITIZEN',
          joinedAt: mockMemberships[0].joinedAt,
        },
      ]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.getUserCommunities('non-existent-id', { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update profile and return sanitized user', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-uuid-1',
        username: 'janedoe',
      });

      const updatedUserData = {
        ...mockUser,
        displayName: 'Jane Updated',
        bio: 'New bio',
      };

      prisma.user.update.mockResolvedValue(updatedUserData);

      const result = await service.updateProfile('user-uuid-1', {
        displayName: 'Jane Updated',
        bio: 'New bio',
      });

      expect(result).toEqual({
        user: updatedUserData,
      });
    });

    it('should throw ConflictException if username is taken by another user', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({
          id: 'user-uuid-1',
          username: 'janedoe',
        })
        .mockResolvedValueOnce({
          id: 'other-user-uuid',
        });

      await expect(
        service.updateProfile('user-uuid-1', {
          username: 'taken_username',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProfile('non-existent-id', {
          displayName: 'Jane',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
