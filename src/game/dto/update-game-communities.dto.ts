import {
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export class UpdateGameCommunitiesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  communityIds: string[];
}
