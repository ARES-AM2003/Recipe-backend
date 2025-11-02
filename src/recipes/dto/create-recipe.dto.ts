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
import { ApiProperty } from '@nestjs/swagger';
import {
  CuisineType,
  DifficultyLevel,
  MealType,
} from '../entities/recipe.entity';

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

  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

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

  @IsNumber()
  @Min(0)
  sodium: number; // in grams
}

export class BulkCreateRecipeDto {
  @ApiProperty({
    description: 'Array of recipes to create in bulk',
    type: [CreateRecipeDto],
    example: [
      {
        title: 'Pasta Carbonara',
        description: 'Classic Italian pasta dish',
        difficulty: 'EASY',
        instructions: ['Boil pasta', 'Cook bacon', 'Mix with eggs and cheese'],
        prepTime: 10,
        cookTime: 15,
        servings: 4,
        cuisine: 'ITALIAN',
        mealType: 'DINNER',
        tags: ['pasta', 'italian'],
        imageUrl: 'https://example.com/carbonara.jpg',
        ingredients: [
          {
            ingredientId: '123e4567-e89b-12d3-a456-426614174000',
            amount: 400,
            unit: 'g',
          },
          {
            ingredientId: '123e4567-e89b-12d3-a456-426614174001',
            amount: 200,
            unit: 'g',
          },
        ],
        calories: 450,
        protein: 25,
        carbs: 55,
        fat: 15,
        fiber: 3,
        sugar: 2,
        sodium: 1.5,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeDto)
  recipes: CreateRecipeDto[];
}

export class BulkCreateRecipeResultDto {
  @ApiProperty({ description: 'Number of recipes successfully created' })
  successCount: number;

  @ApiProperty({ description: 'Number of recipes that failed to create' })
  failureCount: number;

  @ApiProperty({
    description: 'List of created recipe IDs',
    type: [String],
  })
  createdRecipeIds: string[];

  @ApiProperty({
    description: 'List of errors encountered during processing',
    type: [Object],
    example: [{ index: 0, error: 'Ingredient not found' }],
  })
  errors: Array<{ index: number; error: string }>;

  @ApiProperty({ description: 'Processing summary message' })
  message: string;
}
