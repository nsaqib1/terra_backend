import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  GameCategory,
  GameStatus,
  GameType,
} from '../../generated/prisma/enums';

export class UpdateGameDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain only lowercase alphanumeric characters and single hyphens',
  })
  slug?: string;

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
  category?: GameCategory;

  @IsOptional()
  @IsEnum(GameType)
  type?: GameType;

  @IsOptional()
  @IsEnum(GameStatus)
  status?: GameStatus;

  @IsOptional()
  @IsBoolean()
  scoreEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  leaderboardEnabled?: boolean;
}
