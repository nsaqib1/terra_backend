import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;
  let service: {
    getProfile: jest.Mock;
    getUserPosts: jest.Mock;
    getUserCommunities: jest.Mock;
    updateProfile: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getProfile: jest.fn(),
      getUserPosts: jest.fn(),
      getUserCommunities: jest.fn(),
      updateProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should delegate to userService.getProfile', async () => {
      const mockResult = { user: { id: 'u1' }, stats: { posts: 1, upvotes: 2, communities: 3 } };
      service.getProfile.mockResolvedValue(mockResult);

      const result = await controller.getProfile('u1');
      expect(service.getProfile).toHaveBeenCalledWith('u1');
      expect(result).toBe(mockResult);
    });
  });

  describe('getUserPosts', () => {
    it('should delegate to userService.getUserPosts', async () => {
      const mockResult = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      service.getUserPosts.mockResolvedValue(mockResult);

      const query = { page: 1, limit: 10 };
      const result = await controller.getUserPosts('u1', query);
      expect(service.getUserPosts).toHaveBeenCalledWith('u1', query);
      expect(result).toBe(mockResult);
    });
  });

  describe('getUserCommunities', () => {
    it('should delegate to userService.getUserCommunities', async () => {
      const mockResult = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
      service.getUserCommunities.mockResolvedValue(mockResult);

      const query = { page: 1, limit: 20 };
      const result = await controller.getUserCommunities('u1', query);
      expect(service.getUserCommunities).toHaveBeenCalledWith('u1', query);
      expect(result).toBe(mockResult);
    });
  });

  describe('updateProfile', () => {
    it('should delegate to userService.updateProfile with authenticated user id', async () => {
      const mockResult = { user: { id: 'u1', displayName: 'Jane' } };
      service.updateProfile.mockResolvedValue(mockResult);

      const req = { user: { userId: 'u1' } } as any;
      const dto = { displayName: 'Jane' };
      const result = await controller.updateProfile(req, dto);
      expect(service.updateProfile).toHaveBeenCalledWith('u1', dto);
      expect(result).toBe(mockResult);
    });
  });
});
