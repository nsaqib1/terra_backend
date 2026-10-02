import {
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ListGamesDto } from './dto/list-games.dto';

@Injectable()
export class GameService {
	constructor(private readonly prisma: PrismaService) { }

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
}