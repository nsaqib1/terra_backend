import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { PrismaService } from '../database/prisma.service';

describe('InvitesService', () => {
  let service: InvitesService;
  let prismaMock: any;
  let configMock: any;

  beforeEach(async () => {
    prismaMock = {
      invite: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      inviteUsage: {
        create: jest.fn(),
        count: jest.fn(),
      },
    };

    configMock = {
      get: jest.fn().mockReturnValue(undefined), // Defaults to enabled
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<InvitesService>(InvitesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isInviteOnlyEnabled', () => {
    it('should return true by default when config is not set', () => {
      expect(service.isInviteOnlyEnabled()).toBe(true);
    });

    it('should return false when config is "false"', () => {
      configMock.get.mockReturnValueOnce('false');
      expect(service.isInviteOnlyEnabled()).toBe(false);
    });
  });

  describe('generateCode', () => {
    it('should generate a code with prefix BETA-', () => {
      const code = service.generateCode();
      expect(code.startsWith('BETA-')).toBe(true);
      expect(code.length).toBe(11);
    });
  });

  describe('validateInviteCode', () => {
    it('should throw BadRequestException if code is empty', async () => {
      await expect(service.validateInviteCode('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if code not found', async () => {
      prismaMock.invite.findUnique.mockResolvedValueOnce(null);
      await expect(service.validateInviteCode('INVALID')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if code is disabled', async () => {
      prismaMock.invite.findUnique.mockResolvedValueOnce({
        id: '1',
        code: 'BETA-123',
        isActive: false,
        maxUses: 1,
        usedCount: 0,
      });
      await expect(service.validateInviteCode('BETA-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if max uses reached', async () => {
      prismaMock.invite.findUnique.mockResolvedValueOnce({
        id: '1',
        code: 'BETA-123',
        isActive: true,
        maxUses: 1,
        usedCount: 1,
      });
      await expect(service.validateInviteCode('BETA-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return valid info if code is active and has remaining capacity', async () => {
      prismaMock.invite.findUnique.mockResolvedValueOnce({
        id: '1',
        code: 'BETA-123',
        label: 'Tester 1',
        isActive: true,
        maxUses: 3,
        usedCount: 1,
        expiresAt: null,
      });

      const res = await service.validateInviteCode('beta-123');
      expect(res.valid).toBe(true);
      expect(res.remainingUses).toBe(2);
      expect(res.label).toBe('Tester 1');
    });
  });
});
