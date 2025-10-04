import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecipesService } from './recipes.service';
import { RecipeFilterService } from './recipe-filter.service';
import { RecipesController } from './recipes.controller';
import { Recipe } from './entities/recipe.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { UsersModule } from '../users/users.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { ExcelParserService } from './utils/excel-parser.service';
import { LikesService } from './likes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Recipe, User, Ingredient]),
    UsersModule,
    IngredientsModule,
  ],
  controllers: [RecipesController],
  providers: [
    RecipesService,
    RecipeFilterService,
    ExcelParserService,
    LikesService,
  ],
  exports: [RecipesService],
})
export class RecipesModule {}
