import { ApiProperty } from '@nestjs/swagger';
import { Recipe } from '../entities/recipe.entity';

export class RecipeWithLikesDto extends Recipe {
  @ApiProperty({
    description: 'Total number of users who liked this recipe',
    example: 15,
    type: 'number',
  })
  likedCount: number;
}

export class RecipeResponseDto {
  @ApiProperty({
    description: 'Recipe ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Recipe title',
    example: 'Spaghetti Carbonara',
  })
  title: string;

  @ApiProperty({
    description: 'Recipe description',
    example: 'Classic Italian pasta dish with eggs, cheese, and pancetta',
  })
  description: string;

  @ApiProperty({
    description: 'Difficulty level',
    example: 'Medium',
  })
  difficulty: string;

  @ApiProperty({
    description: 'Cooking instructions',
    type: [String],
    example: ['Boil pasta', 'Cook pancetta', 'Mix eggs with cheese'],
  })
  instructions: string[];

  @ApiProperty({
    description: 'Preparation time in minutes',
    example: 10,
  })
  prepTime: number;

  @ApiProperty({
    description: 'Cooking time in minutes',
    example: 15,
  })
  cookTime: number;

  @ApiProperty({
    description: 'Number of servings',
    example: 4,
  })
  servings: number;

  @ApiProperty({
    description: 'Cuisine type',
    example: 'Italian',
  })
  cuisine: string;

  @ApiProperty({
    description: 'Meal type',
    example: 'Dinner',
  })
  mealType: string;

  @ApiProperty({
    description: 'Recipe tags',
    type: [String],
    example: ['pasta', 'italian', 'creamy'],
  })
  tags: string[];

  @ApiProperty({
    description: 'Image URL',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  imageUrl?: string;

  @ApiProperty({
    description: 'Average rating',
    example: 4.5,
  })
  averageRating: number;

  @ApiProperty({
    description: 'Number of reviews',
    example: 12,
  })
  reviewCount: number;

  @ApiProperty({
    description: 'Calories per serving',
    example: 450,
  })
  calories: number;

  @ApiProperty({
    description: 'Protein in grams per serving',
    example: 18,
  })
  protein: number;

  @ApiProperty({
    description: 'Carbohydrates in grams per serving',
    example: 55,
  })
  carbs: number;

  @ApiProperty({
    description: 'Fat in grams per serving',
    example: 22,
  })
  fat: number;

  @ApiProperty({
    description: 'Fiber in grams per serving',
    example: 3,
  })
  fiber: number;

  @ApiProperty({
    description: 'Sugar in grams per serving',
    example: 2,
  })
  sugar: number;

  @ApiProperty({
    description: 'Sodium in grams per serving',
    example: 1.2,
  })
  sodium: number;

  @ApiProperty({
    description: 'Recipe author information',
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' },
    },
  })
  author: {
    id: string;
    name: string;
    email: string;
  };

  @ApiProperty({
    description: 'Recipe ingredients',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        category: { type: 'string' },
      },
    },
  })
  ingredients: Array<{
    id: string;
    name: string;
    category: string;
  }>;

  @ApiProperty({
    description: 'Total number of users who liked this recipe',
    example: 15,
  })
  likedCount: number;

  @ApiProperty({
    description: 'Recipe creation date',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Recipe last update date',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;
}
