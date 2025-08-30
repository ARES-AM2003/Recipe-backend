import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CuisineType, MealType } from '../entities/recipe.entity';

export class IngredientAmountDto {
  @IsString()
  @IsNotEmpty()
  ingredientId: string;

  @IsNumber()
  @Min(0.1)
  amount: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateRecipeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  instructions?: string[];

  @IsNumber()
  @Min(1)
  prepTime: number; // in minutes

  @IsNumber()
  @Min(0)
  cookTime: number; // in minutes

  @IsNumber()
  @Min(1)
  servings: number;

  @IsEnum(CuisineType)
  cuisine: CuisineType;

  @IsEnum(MealType)
  mealType: MealType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientAmountDto)
  ingredients: IngredientAmountDto[];

  // Nutrition information (per serving)
  @IsNumber()
  @Min(0)
  calories: number;

  @IsNumber()
  @Min(0)
  protein: number; // in grams

  @IsNumber()
  @Min(0)
  carbs: number; // in grams

  @IsNumber()
  @Min(0)
  fat: number; // in grams

  @IsNumber()
  @Min(0)
  fiber: number; // in grams

  @IsNumber()
  @Min(0)
  sugar: number; // in grams
}
