import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateCommentDto {
  @IsUUID()
  postId!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  @Length(1, 10000)
  body!: string;
}