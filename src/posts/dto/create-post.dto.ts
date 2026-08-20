import { IsArray, IsUUID } from 'class-validator';
import { PostDocument } from '../schemas/post-document.schema';

export class CreatePostDto {
  document!: PostDocument;

  @IsArray()
  @IsUUID('4', { each: true })
  hashtagIds!: string[];
}