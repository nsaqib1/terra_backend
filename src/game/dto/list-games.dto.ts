import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { GameCategory, GameStatus, GameType } from '../../generated/prisma/client';

export class ListGamesDto {
	@IsOptional()
	@IsEnum(GameCategory)
	category?: GameCategory;

	@IsOptional()
	@IsEnum(GameType)
	type?: GameType;

	@IsOptional()
	@IsEnum(GameStatus)
	status?: GameStatus;

	@IsOptional()
	@IsString()
	@MaxLength(100)
	q?: string;

	@IsOptional()
	@IsString()
	communityId?: string;
}