import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ProposeCommunityDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @IsString()
  @MinLength(20)
  @MaxLength(1000)
  description: string;

  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  reason: string;
}