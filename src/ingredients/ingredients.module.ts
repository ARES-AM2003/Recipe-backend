import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientsService } from './ingredients.service';
import { IngredientsController } from './ingredients.controller';
import { CategoriesController } from './categories.controller';
import { Ingredient } from './entities/ingredient.entity';
import { Recipe } from '../recipes/entities/recipe.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ingredient, Recipe])],
  controllers: [IngredientsController, CategoriesController],
  providers: [IngredientsService],
  exports: [IngredientsService],
})
export class IngredientsModule {}
