import {
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
  @IsUUID('4', { each: true })
  hashtagIds!: string[];
}