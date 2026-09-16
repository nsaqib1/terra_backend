import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Username can only contain alphanumeric characters and underscores',
  })
  username?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    return value;
  })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1000)
  bio?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    return value;
  })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(150)
  location?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    return value;
  })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  website?: string | null;
}
