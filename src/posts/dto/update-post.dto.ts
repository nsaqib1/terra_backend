import {
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
  @IsUUID('4', { each: true })
  hashtagIds?: string[];
}