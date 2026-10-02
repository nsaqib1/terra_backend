import {
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { ListGamesDto } from './dto/list-games.dto';

@Injectable()
export class GameService {
	constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService,) { }

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

		const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

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
}