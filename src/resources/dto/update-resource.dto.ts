import { IsArray, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class UpdateResourceDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @IsOptional()
  @IsIn(['PUBLISHED', 'UNPUBLISHED'])
  status?: 'PUBLISHED' | 'UNPUBLISHED';
}
