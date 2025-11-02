import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecipesService } from './recipes.service';
import { RecipeFilterService } from './recipe-filter.service';
import { RecipesController } from './recipes.controller';
import { Recipe } from './entities/recipe.entity';
import { SavedRecipe } from './entities/saved-recipe.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { UsersModule } from '../users/users.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { ExcelParserService } from './utils/excel-parser.service';
import { RecipeExtractorService } from './recipe-extractor.service';
import { LikesService } from './likes.service';
import { SavedRecipesService } from './saved-recipes.service';
import { Rating } from './entities/rating.entity';
import { RatingsService } from './ratings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Recipe, SavedRecipe, Rating, User, Ingredient]),
    UsersModule,
    IngredientsModule,
  ],
  controllers: [RecipesController],
  providers: [
    RecipesService,
    RecipeFilterService,
    RecipeExtractorService,
    ExcelParserService,
    LikesService,
    SavedRecipesService,
    RatingsService,
  ],
  exports: [RecipesService],
})
export class RecipesModule {}
