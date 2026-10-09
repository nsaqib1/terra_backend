import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsObject()
  document?: unknown;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'A post can have at most 5 topics' })
  @IsUUID('4', { each: true })
  tagIds?: string[];
}