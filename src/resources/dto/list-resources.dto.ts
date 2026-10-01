import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListResourcesDto {
  @IsString()
  communityId!: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  tagIds?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest', 'downloads'])
  sort: 'newest' | 'oldest' | 'downloads' = 'newest';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
