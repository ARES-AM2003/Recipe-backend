import {
  IsUrl,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExtractRecipeFromUrlDto {
  @ApiProperty({
    description:
      'URL of the recipe webpage to extract (required if rawHtml is not provided)',
    example: 'https://www.allrecipes.com/recipe/12345/pasta-carbonara/',
    required: false,
  })
  @ValidateIf((o) => !o.rawHtml)
  @IsUrl()
  @IsNotEmpty()
  url?: string;

  @ApiProperty({
    description:
      'Optional raw HTML content (use this if the URL is blocked). Either url or rawHtml must be provided.',
    example: '<html><body><h1>Recipe Title</h1>...</body></html>',
    required: false,
  })
  @ValidateIf((o) => !o.url)
  @IsString()
  @IsNotEmpty()
  rawHtml?: string;

  @ApiProperty({
    description: 'Optional additional instructions for AI extraction',
    example: 'Focus on nutritional information',
    required: false,
  })
  @IsString()
  @IsOptional()
  additionalInstructions?: string;
}

export class ExtractedRecipeDataDto {
  @ApiProperty({ description: 'Extracted recipe title' })
  title: string;

  @ApiProperty({ description: 'Extracted recipe description' })
  description: string;

  @ApiProperty({ description: 'Difficulty level', required: false })
  difficulty?: string;

  @ApiProperty({ description: 'Preparation time in minutes', required: false })
  prepTime?: number;

  @ApiProperty({ description: 'Cooking time in minutes', required: false })
  cookTime?: number;

  @ApiProperty({ description: 'Number of servings', required: false })
  servings?: number;

  @ApiProperty({ description: 'Cuisine type', required: false })
  cuisine?: string;

  @ApiProperty({ description: 'Meal type', required: false })
  mealType?: string;

  @ApiProperty({ description: 'List of instructions', type: [String] })
  instructions: string[];

  @ApiProperty({ description: 'List of tags', type: [String], required: false })
  tags?: string[];

  @ApiProperty({ description: 'Image URL', required: false })
  imageUrl?: string;

  @ApiProperty({
    description: 'List of ingredients with amounts',
    type: [Object],
    example: [
      { name: 'pasta', amount: 400, unit: 'g' },
      { name: 'bacon', amount: 200, unit: 'g' },
    ],
  })
  ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
    notes?: string;
  }>;

  @ApiProperty({ description: 'Calories per serving', required: false })
  calories?: number;

  @ApiProperty({ description: 'Protein in grams', required: false })
  protein?: number;

  @ApiProperty({ description: 'Carbs in grams', required: false })
  carbs?: number;

  @ApiProperty({ description: 'Fat in grams', required: false })
  fat?: number;

  @ApiProperty({ description: 'Fiber in grams', required: false })
  fiber?: number;

  @ApiProperty({ description: 'Sugar in grams', required: false })
  sugar?: number;

  @ApiProperty({ description: 'Sodium in grams', required: false })
  sodium?: number;

  @ApiProperty({ description: 'Source URL of the recipe' })
  sourceUrl: string;
}
