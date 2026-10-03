import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  GameCategory,
  GameStatus,
  GameType,
} from '../../generated/prisma/enums';

export class CreateGameDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain only lowercase alphanumeric characters and single hyphens',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  thumbnailUrl?: string;

  @IsOptional()
  @IsEnum(GameCategory)
  category?: GameCategory = GameCategory.ENTERTAINMENT;

  @IsOptional()
  @IsEnum(GameType)
  type?: GameType = GameType.SINGLE_PLAYER;

  @IsOptional()
  @IsEnum(GameStatus)
  status?: GameStatus = GameStatus.DRAFT;

  @IsOptional()
  @IsBoolean()
  scoreEnabled?: boolean = false;

  @IsOptional()
  @IsBoolean()
  leaderboardEnabled?: boolean = false;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  communityIds?: string[];
}
