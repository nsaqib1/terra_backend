import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateGameVersionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[0-9A-Za-z._-]+$/, {
    message:
      'Version may contain only letters, numbers, dots, hyphens, and underscores',
  })
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  releaseNotes?: string;
}