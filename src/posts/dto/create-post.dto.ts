import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsUUID,
} from 'class-validator';

export class CreatePostDto {
  @IsUUID()
  communityId!: string;

  @IsObject()
  document!: unknown;

  @IsArray()
  @ArrayMaxSize(5, { message: 'A post can have at most 5 topics' })
  @IsUUID('4', { each: true })
  tagIds!: string[];
}