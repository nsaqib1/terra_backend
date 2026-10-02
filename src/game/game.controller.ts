import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { GameService } from './game.service';
import { ListGamesDto } from './dto/list-games.dto';

@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) { }

  @Get()
  async list(@Query() dto: ListGamesDto) {
    return this.gameService.list(dto);
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.gameService.findBySlug(slug);
  }
}