import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CommunityMaturity,
  CommunityStatus,
  GovernanceMode,
} from '../../generated/prisma/enums';

export class UpdateCommunityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

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
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(CommunityStatus)
  status?: CommunityStatus;

  @IsOptional()
  @IsEnum(CommunityMaturity)
  maturity?: CommunityMaturity;

  @IsOptional()
  @IsEnum(GovernanceMode)
  governanceMode?: GovernanceMode;
}
