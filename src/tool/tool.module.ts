import { Module } from '@nestjs/common';
import { ToolController } from './tool.controller';
import { ToolService } from './tool.service';
import { ToolBuildStorageService } from './tool-build.storage.service';
@Module({ controllers: [ToolController], providers: [ToolService, ToolBuildStorageService], exports: [ToolService, ToolBuildStorageService] })
export class ToolModule {}
