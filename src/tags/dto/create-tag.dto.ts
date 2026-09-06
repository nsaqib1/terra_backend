import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateTagDto {
  @IsUUID()
  communityId!: string;

  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must contain lowercase letters, numbers, and hyphens only',
  })
  slug?: string;
}