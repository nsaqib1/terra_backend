import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export type PostSortOption = 'newest' | 'top' | 'comments' | 'oldest';

export class GetPostsQueryDto {
  @IsOptional()
  @IsUUID()
  communityId?: string;

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

  @IsOptional()
  @IsIn(['newest', 'top', 'comments', 'oldest', 'score', 'popular', 'most_discussed'])
  sort?: string = 'newest';
}