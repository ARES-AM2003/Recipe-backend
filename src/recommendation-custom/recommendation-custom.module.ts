import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommendationCustomController } from './recommendation-custom.controller';
import { RecommendationCustomService } from './recommendation-custom.service';
import { Recipe } from '../recipes/entities/recipe.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Recipe, User, Ingredient])],
  controllers: [RecommendationCustomController],
  providers: [RecommendationCustomService],
  exports: [RecommendationCustomService],
})
export class RecommendationCustomModule {}
