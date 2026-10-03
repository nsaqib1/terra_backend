import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { ListGamesDto } from './dto/list-games.dto';
import { AdminGameQueryDto } from './dto/admin-game-query.dto';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { CreateGameVersionDto } from './dto/create-game-version.dto';
import { UpdateGameVersionDto } from './dto/update-game-version.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GameService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
	) { }

	async list(dto: ListGamesDto) {
		const where = {
			status: 'PUBLISHED' as const,
			deletedAt: null,

			...(dto.category
				? {
					category: dto.category,
				}
				: {}),

			...(dto.type
				? {
					type: dto.type,
				}
				: {}),

			...(dto.q
				? {
					OR: [
						{
							title: {
								contains: dto.q,
								mode: 'insensitive' as const,
							},
						},
						{
							description: {
								contains: dto.q,
								mode: 'insensitive' as const,
							},
						},
					],
				}
				: {}),

			...(dto.communityId
				? {
					communities: {
						some: {
							communityId: dto.communityId,
						},
					},
				}
				: {}),
		};

		const games = await this.prisma.game.findMany({
			where,
			orderBy: {
				title: 'asc',
			},
			select: this.gameSelect(),
		});

		return games.map((game) => this.serializeGame(game));
	}

	async findBySlug(slug: string) {
		const game = await this.prisma.game.findFirst({
			where: {
				slug: slug.toLowerCase(),
				status: 'PUBLISHED',
				deletedAt: null,
			},
			select: this.gameSelect(),
		});

		if (!game) {
			throw new NotFoundException('Game not found');
		}

		return this.serializeGame(game);
	}

	async startSession(slug: string, userId?: string) {
		const game = await this.prisma.game.findFirst({
			where: {
				slug: slug.toLowerCase(),
				status: 'PUBLISHED',
				deletedAt: null,
			},
			select: {
				id: true,
				slug: true,
				title: true,
				currentVersionId: true,
				scoreEnabled: true,
				leaderboardEnabled: true,
			},
		});

		if (!game) {
			throw new NotFoundException('Game not found');
		}

		if (!game.currentVersionId) {
			throw new NotFoundException(
				'This game does not have a published version',
			);
		}

		const gameVersion = await this.prisma.gameVersion.findFirst({
			where: {
				id: game.currentVersionId,
				gameId: game.id,
				status: 'PUBLISHED',
			},
			select: {
				id: true,
				version: true,
				buildPath: true,
			},
		});

		if (!gameVersion) {
			throw new NotFoundException(
				'This game does not have a valid published version',
			);
		}

		const expiresInSeconds = this.configService.getOrThrow<number>(
			'GAME_SESSION_EXPIRES_SECONDS',
		);

		const expiresAt = new Date(
			Date.now() + expiresInSeconds * 1000,
		);

		const session = await this.prisma.gameSession.create({
			data: {
				gameId: game.id,
				gameVersionId: gameVersion.id,
				userId: userId ?? null,
				expiresAt,
				status: 'ACTIVE',
			},
		});

		const token = await this.jwtService.signAsync({
			sub: session.id,
			gameId: game.id,
			gameVersionId: gameVersion.id,
			...(userId ? { userId } : {}),
			type: 'game-session',
		});

		return {
			sessionId: session.id,
			token,
			expiresAt,
			game: {
				id: game.id,
				slug: game.slug,
				title: game.title,
				scoreEnabled: game.scoreEnabled,
				leaderboardEnabled: game.leaderboardEnabled,
			},
			version: {
				id: gameVersion.id,
				version: gameVersion.version,
				buildPath: gameVersion.buildPath,
			},
		};
	}

	private gameSelect() {
		return {
			id: true,
			slug: true,
			title: true,
			description: true,
			thumbnailUrl: true,
			category: true,
			type: true,
			status: true,
			scoreEnabled: true,
			leaderboardEnabled: true,
			currentVersionId: true,
			createdAt: true,
			updatedAt: true,

			communities: {
				select: {
					community: {
						select: {
							id: true,
							name: true,
							slug: true,
						},
					},
				},
			},
		};
	}

	private serializeGame(game: any) {
		return {
			id: game.id,
			slug: game.slug,
			title: game.title,
			description: game.description,
			thumbnailUrl: game.thumbnailUrl,
			category: game.category,
			type: game.type,
			scoreEnabled: game.scoreEnabled,
			leaderboardEnabled: game.leaderboardEnabled,
			currentVersionId: game.currentVersionId,

			communities: game.communities.map(
				(relation: any) => relation.community,
			),

			createdAt: game.createdAt,
			updatedAt: game.updatedAt,
		};
	}


	async adminList(dto: AdminGameQueryDto) {
		const page = dto.page ?? 1;
		const limit = dto.limit ?? 20;
		const skip = (page - 1) * limit;

		const where: any = {};

		if (dto.status) where.status = dto.status;
		if (dto.category) where.category = dto.category;
		if (dto.type) where.type = dto.type;

		if (dto.communityId) {
			where.communities = {
				some: {
					communityId: dto.communityId,
				},
			};
		}

		if (dto.search?.trim()) {
			const term = dto.search.trim();
			where.OR = [
				{ title: { contains: term, mode: 'insensitive' } },
				{ slug: { contains: term, mode: 'insensitive' } },
				{ description: { contains: term, mode: 'insensitive' } },
			];
		}

		const orderBy = {
			[dto.sortBy ?? 'createdAt']: dto.sortOrder ?? 'desc',
		};

		const [games, total] = await this.prisma.$transaction([
			this.prisma.game.findMany({
				where,
				orderBy,
				skip,
				take: limit,
				select: {
					id: true,
					slug: true,
					title: true,
					description: true,
					thumbnailUrl: true,
					category: true,
					type: true,
					status: true,
					scoreEnabled: true,
					leaderboardEnabled: true,
					currentVersionId: true,
					createdAt: true,
					updatedAt: true,
					deletedAt: true,
					communities: {
						select: {
							community: {
								select: {
									id: true,
									name: true,
									slug: true,
								},
							},
						},
					},
					versions: {
						select: {
							id: true,
							version: true,
							buildPath: true,
							status: true,
							publishedAt: true,
						},
						orderBy: { createdAt: 'desc' },
					},
					_count: {
						select: {
							sessions: true,
							scores: true,
						},
					},
				},
			}),
			this.prisma.game.count({ where }),
		]);

		return {
			data: games.map((game) => ({
				...game,
				communities: game.communities.map((relation) => relation.community),
			})),
			meta: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async adminGetById(id: string) {
		const game = await this.prisma.game.findUnique({
			where: { id },
			select: {
				id: true,
				slug: true,
				title: true,
				description: true,
				thumbnailUrl: true,
				category: true,
				type: true,
				status: true,
				scoreEnabled: true,
				leaderboardEnabled: true,
				currentVersionId: true,
				createdAt: true,
				updatedAt: true,
				deletedAt: true,
				communities: {
					select: {
						community: {
							select: {
								id: true,
								name: true,
								slug: true,
							},
						},
					},
				},
				versions: {
					select: {
						id: true,
						version: true,
						buildPath: true,
						status: true,
						releaseNotes: true,
						createdAt: true,
						updatedAt: true,
						publishedAt: true,
					},
					orderBy: { createdAt: 'desc' },
				},
				_count: {
					select: {
						sessions: true,
						scores: true,
					},
				},
			},
		});

		if (!game) {
			throw new NotFoundException('Game not found');
		}

		return {
			...game,
			communities: game.communities.map((relation) => relation.community),
		};
	}

	async adminCreate(dto: CreateGameDto) {
		await this.validateCommunityIds(dto.communityIds ?? []);
		if (dto.status === 'PUBLISHED') {
			throw new BadRequestException('Create the game as a draft, publish a version, then publish the game');
		}

		try {
			const game = await this.prisma.game.create({
				data: {
					title: dto.title.trim(),
					slug: dto.slug.toLowerCase(),
					description: dto.description?.trim() || null,
					thumbnailUrl: dto.thumbnailUrl?.trim() || null,
					category: dto.category ?? 'ENTERTAINMENT',
					type: dto.type ?? 'SINGLE_PLAYER',
					status: dto.status ?? 'DRAFT',
					scoreEnabled: dto.scoreEnabled ?? false,
					leaderboardEnabled: dto.leaderboardEnabled ?? false,
					communities: dto.communityIds?.length
						? {
							create: dto.communityIds.map((communityId) => ({
								community: { connect: { id: communityId } },
							})),
						}
						: undefined,
				},
				select: { id: true },
			});

			return this.adminGetById(game.id);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			) {
				throw new ConflictException('A game with this slug already exists');
			}
			throw error;
		}
	}

	async adminUpdate(id: string, dto: UpdateGameDto) {
		await this.ensureGameExists(id);

		if (dto.status === 'PUBLISHED') {
			await this.assertPublishableGame(id);
		}

		try {
			await this.prisma.game.update({
				where: { id },
				data: {
					...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
					...(dto.slug !== undefined ? { slug: dto.slug.toLowerCase() } : {}),
					...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
					...(dto.thumbnailUrl !== undefined ? { thumbnailUrl: dto.thumbnailUrl.trim() || null } : {}),
					...(dto.category !== undefined ? { category: dto.category } : {}),
					...(dto.type !== undefined ? { type: dto.type } : {}),
					...(dto.status !== undefined ? { status: dto.status } : {}),
					...(dto.scoreEnabled !== undefined ? { scoreEnabled: dto.scoreEnabled } : {}),
					...(dto.leaderboardEnabled !== undefined ? { leaderboardEnabled: dto.leaderboardEnabled } : {}),
				},
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			) {
				throw new ConflictException('A game with this slug already exists');
			}
			throw error;
		}

		return this.adminGetById(id);
	}

	async adminUpdateCommunities(id: string, communityIds: string[]) {
		await this.ensureGameExists(id);
		await this.validateCommunityIds(communityIds);

		await this.prisma.$transaction(async (tx) => {
			await tx.gameCommunity.deleteMany({ where: { gameId: id } });

			if (communityIds.length > 0) {
				await tx.gameCommunity.createMany({
					data: communityIds.map((communityId) => ({
						gameId: id,
						communityId,
					})),
				});
			}
		});

		return this.adminGetById(id);
	}

	async adminDelete(id: string) {
		await this.ensureGameExists(id);

		await this.prisma.game.update({
			where: { id },
			data: {
				status: 'ARCHIVED',
				deletedAt: new Date(),
			},
		});

		return this.adminGetById(id);
	}

	async adminPublish(id: string) {
		const game = await this.prisma.game.findUnique({
			where: { id },
			select: { id: true, deletedAt: true, currentVersionId: true },
		});

		if (!game) throw new NotFoundException('Game not found');
		if (game.deletedAt) {
			throw new BadRequestException('Archived games cannot be published');
		}
		if (!game.currentVersionId) {
			throw new BadRequestException('Publish a game version before publishing the game');
		}

		const currentVersion = await this.prisma.gameVersion.findFirst({
			where: { id: game.currentVersionId, gameId: id, status: 'PUBLISHED' },
			select: { id: true, buildPath: true },
		});
		if (!currentVersion?.buildPath) {
			throw new BadRequestException('The current game version does not have a playable build');
		}

		await this.prisma.game.update({
			where: { id },
			data: { status: 'PUBLISHED' },
		});

		return this.adminGetById(id);
	}


	async adminListVersions(gameId: string) {
		await this.ensureGameExists(gameId);

		return this.prisma.gameVersion.findMany({
			where: { gameId },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				gameId: true,
				version: true,
				buildPath: true,
				status: true,
				releaseNotes: true,
				createdAt: true,
				updatedAt: true,
				publishedAt: true,
			},
		});
	}

	async adminCreateVersion(gameId: string, dto: CreateGameVersionDto) {
		await this.ensureGameExists(gameId);

		try {
			return await this.prisma.gameVersion.create({
				data: {
					gameId,
					version: dto.version.trim(),
					buildPath: dto.buildPath?.trim() || null,
					releaseNotes: dto.releaseNotes?.trim() || null,
				},
				select: {
					id: true,
					gameId: true,
					version: true,
					buildPath: true,
					status: true,
					releaseNotes: true,
					createdAt: true,
					updatedAt: true,
					publishedAt: true,
				},
			});
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				throw new ConflictException('A version with this number already exists for this game');
			}
			throw error;
		}
	}

	async adminUpdateVersion(gameId: string, versionId: string, dto: UpdateGameVersionDto) {
		const version = await this.prisma.gameVersion.findFirst({ where: { id: versionId, gameId } });
		if (!version) throw new NotFoundException('Game version not found');
		if (version.status !== 'DRAFT') throw new BadRequestException('Only draft versions can be edited');

		try {
			return await this.prisma.gameVersion.update({
				where: { id: versionId },
				data: {
					...(dto.version !== undefined ? { version: dto.version.trim() } : {}),
					...(dto.buildPath !== undefined ? { buildPath: dto.buildPath?.trim() || null } : {}),
					...(dto.releaseNotes !== undefined ? { releaseNotes: dto.releaseNotes?.trim() || null } : {}),
				},
				select: {
					id: true, gameId: true, version: true, buildPath: true, status: true,
					releaseNotes: true, createdAt: true, updatedAt: true, publishedAt: true,
				},
			});
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				throw new ConflictException('A version with this number already exists for this game');
			}
			throw error;
		}
	}

	async adminPublishVersion(gameId: string, versionId: string) {
		const version = await this.prisma.gameVersion.findFirst({
			where: { id: versionId, gameId },
			select: { id: true, buildPath: true, status: true },
		});
		if (!version) throw new NotFoundException('Game version not found');
		if (!version.buildPath?.trim()) throw new BadRequestException('Upload a playable build before publishing this version');
		if (version.status === 'ARCHIVED') throw new BadRequestException('Archived versions cannot be published');

		return this.prisma.$transaction(async (tx) => {
			await tx.gameVersion.updateMany({
				where: { gameId, status: 'PUBLISHED', id: { not: versionId } },
				data: { status: 'ARCHIVED' },
			});

			await tx.gameVersion.update({
				where: { id: versionId },
				data: { status: 'PUBLISHED', publishedAt: new Date() },
			});

			await tx.game.update({
				where: { id: gameId },
				data: { currentVersionId: versionId },
			});

			return tx.gameVersion.findUniqueOrThrow({
				where: { id: versionId },
				select: {
					id: true, gameId: true, version: true, buildPath: true, status: true,
					releaseNotes: true, createdAt: true, updatedAt: true, publishedAt: true,
				},
			});
		});
	}

	async adminArchiveVersion(gameId: string, versionId: string) {
		const version = await this.prisma.gameVersion.findFirst({ where: { id: versionId, gameId } });
		if (!version) throw new NotFoundException('Game version not found');
		if (version.status === 'ARCHIVED') return version;

		const game = await this.prisma.game.findUnique({ where: { id: gameId }, select: { currentVersionId: true } });
		if (game?.currentVersionId === versionId) throw new BadRequestException('The current game version cannot be archived');

		return this.prisma.gameVersion.update({ where: { id: versionId }, data: { status: 'ARCHIVED' } });
	}

	async adminUnpublish(id: string) {
		await this.ensureGameExists(id);

		await this.prisma.game.update({
			where: { id },
			data: { status: 'UNPUBLISHED' },
		});

		return this.adminGetById(id);
	}


	private async assertPublishableGame(id: string) {
		const game = await this.prisma.game.findUnique({
			where: { id },
			select: { currentVersionId: true },
		});
		if (!game) throw new NotFoundException('Game not found');
		if (!game.currentVersionId) {
			throw new BadRequestException('Publish a game version before publishing the game');
		}
		const version = await this.prisma.gameVersion.findFirst({
			where: { id: game.currentVersionId, gameId: id, status: 'PUBLISHED' },
			select: { buildPath: true },
		});
		if (!version?.buildPath) {
			throw new BadRequestException('The current game version does not have a playable build');
		}
	}

	private async ensureGameExists(id: string) {
		const game = await this.prisma.game.findUnique({
			where: { id },
			select: { id: true, deletedAt: true },
		});

		if (!game) {
			throw new NotFoundException('Game not found');
		}

		return game;
	}

	private async validateCommunityIds(communityIds: string[]) {
		if (communityIds.length === 0) return;

		const count = await this.prisma.community.count({
			where: {
				id: { in: communityIds },
				status: 'ACTIVE',
				deletedAt: null,
			},
		});

		if (count !== communityIds.length) {
			throw new BadRequestException(
				'One or more selected communities are invalid or inactive',
			);
		}
	}

	async endSession(sessionId: string) {
		const session = await this.prisma.gameSession.findUnique({
			where: {
				id: sessionId,
			},
			select: {
				id: true,
				status: true,
				endedAt: true,
			},
		});

		if (!session) {
			throw new NotFoundException('Game session not found');
		}

		if (session.status === 'COMPLETED') {
			return {
				sessionId: session.id,
				status: session.status,
				endedAt: session.endedAt,
			};
		}

		if (session.status === 'EXPIRED') {
			return {
				sessionId: session.id,
				status: session.status,
				endedAt: session.endedAt,
			};
		}

		const endedAt = new Date();

		const updated = await this.prisma.gameSession.update({
			where: {
				id: session.id,
			},
			data: {
				status: 'COMPLETED',
				endedAt,
			},
			select: {
				id: true,
				status: true,
				endedAt: true,
			},
		});

		return {
			sessionId: updated.id,
			status: updated.status,
			endedAt: updated.endedAt,
		};
	}

	async submitScore(
		sessionId: string,
		gameId: string,
		gameVersionId: string,
		userId: string | null,
		score: number,
	) {
		if (!userId) {
			throw new UnauthorizedException(
				'You must be signed in to submit a score',
			);
		}

		const game = await this.prisma.game.findFirst({
			where: {
				id: gameId,
				status: 'PUBLISHED',
				deletedAt: null,
			},
			select: {
				id: true,
				scoreEnabled: true,
			},
		});

		if (!game) {
			throw new NotFoundException('Game not found');
		}

		if (!game.scoreEnabled) {
			throw new BadRequestException(
				'Score submission is not enabled for this game',
			);
		}

		const session = await this.prisma.gameSession.findUnique({
			where: {
				id: sessionId,
			},
			select: {
				id: true,
				gameId: true,
				gameVersionId: true,
				userId: true,
				startedAt: true,
				expiresAt: true,
				status: true,
				score: {
					select: {
						id: true,
						score: true,
					},
				},
			},
		});

		if (!session) {
			throw new NotFoundException('Game session not found');
		}

		if (session.gameId !== gameId) {
			throw new UnauthorizedException(
				'Game session does not belong to this game',
			);
		}

		if (session.gameVersionId !== gameVersionId) {
			throw new UnauthorizedException(
				'Game session does not belong to this game version',
			);
		}

		if (session.userId !== userId) {
			throw new UnauthorizedException(
				'Game session does not belong to this user',
			);
		}

		if (session.status !== 'ACTIVE') {
			throw new BadRequestException(
				'This game session is no longer active',
			);
		}

		const now = new Date();

		if (session.expiresAt <= now) {
			await this.prisma.gameSession.update({
				where: {
					id: session.id,
				},
				data: {
					status: 'EXPIRED',
				},
			});

			throw new BadRequestException(
				'This game session has expired',
			);
		}

		if (session.score) {
			throw new ConflictException(
				'A score has already been submitted for this session',
			);
		}

		try {
			const result = await this.prisma.$transaction(async (tx) => {
				const createdScore = await tx.gameScore.create({
					data: {
						gameId: session.gameId,
						gameVersionId: session.gameVersionId,
						gameSessionId: session.id,
						userId,
						score,
					},
					select: {
						id: true,
						score: true,
						createdAt: true,
					},
				});

				await tx.gameSession.update({
					where: {
						id: session.id,
					},
					data: {
						status: 'COMPLETED',
						endedAt: now,
					},
				});

				return createdScore;
			});

			return {
				scoreId: result.id,
				score: result.score,
				submittedAt: result.createdAt,
			};
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			) {
				throw new ConflictException(
					'A score has already been submitted for this session',
				);
			}

			throw error;
		}
	}
}