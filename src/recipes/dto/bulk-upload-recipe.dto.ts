import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  CuisineType,
  DifficultyLevel,
  MealType,
} from '../entities/recipe.entity';

export class BulkRecipeDto {
  @ApiProperty({ description: 'Recipe title' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Recipe description' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Difficulty level',
    enum: DifficultyLevel,
    example: DifficultyLevel.EASY,
  })
  @IsEnum(DifficultyLevel)
  difficulty: DifficultyLevel;

  @ApiProperty({
    description: 'Cooking instructions (separated by semicolon)',
    example: 'Heat oil in pan; Add ingredients; Cook for 10 minutes',
  })
  @IsNotEmpty()
  @IsString()
  instructions: string;

  @ApiProperty({ description: 'Preparation time in minutes' })
  @IsNumber()
  @Min(1)
  prepTime: number;

  @ApiProperty({ description: 'Cooking time in minutes' })
  @IsNumber()
  @Min(1)
  cookTime: number;

  @ApiProperty({ description: 'Number of servings' })
  @IsNumber()
  @Min(1)
  servings: number;

  @ApiProperty({
    description: 'Cuisine type',
    enum: CuisineType,
    example: CuisineType.ITALIAN,
  })
  @IsEnum(CuisineType)
  cuisine: CuisineType;

  @ApiProperty({
    description: 'Meal type',
    enum: MealType,
    example: MealType.DINNER,
  })
  @IsEnum(MealType)
  mealType: MealType;

  @ApiProperty({
    description: 'Tags (separated by comma)',
    example: 'vegetarian,healthy,quick',
    required: false,
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiProperty({ description: 'Image URL', required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ description: 'Calories per serving' })
  @IsNumber()
  @Min(0)
  calories: number;

  @ApiProperty({ description: 'Protein in grams per serving' })
  @IsNumber()
  @Min(0)
  protein: number;

  @ApiProperty({ description: 'Carbohydrates in grams per serving' })
  @IsNumber()
  @Min(0)
  carbs: number;

  @ApiProperty({ description: 'Fat in grams per serving' })
  @IsNumber()
  @Min(0)
  fat: number;

  @ApiProperty({ description: 'Fiber in grams per serving' })
  @IsNumber()
  @Min(0)
  fiber: number;

  @ApiProperty({ description: 'Sugar in grams per serving' })
  @IsNumber()
  @Min(0)
  sugar: number;

  @ApiProperty({ description: 'Sodium in grams per serving' })
  @IsNumber()
  @Min(0)
  sodium: number;

  @ApiProperty({
    description: 'Ingredient names (separated by comma)',
    example: 'tomato,onion,garlic,olive oil',
  })
  @IsNotEmpty()
  @IsString()
  ingredients: string;
}

export class BulkUploadResultDto {
  @ApiProperty({ description: 'Number of recipes successfully processed' })
  successCount: number;

  @ApiProperty({ description: 'Number of recipes that failed to process' })
  failureCount: number;

  @ApiProperty({
    description: 'List of created recipe IDs',
    type: [String],
  })
  createdRecipeIds: string[];

  @ApiProperty({
    description: 'List of errors encountered during processing',
    type: [String],
  })
  errors: string[];

  @ApiProperty({ description: 'Processing summary message' })
  message: string;
}
