// src/recommendation-vec/recommendation-vec.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommendationVecService } from './recommendation-vec.service';
import { RecommendationVecController } from './recommendation-vec.controller';
import { Recipe } from '../recipes/entities/recipe.entity';
import { User } from '../users/entities/user.entity';
import { PantryItem } from '../pantry/entities/pantry-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Recipe, User, PantryItem])],
  providers: [RecommendationVecService],
  controllers: [RecommendationVecController],
})
export class RecommendationVecModule {}
