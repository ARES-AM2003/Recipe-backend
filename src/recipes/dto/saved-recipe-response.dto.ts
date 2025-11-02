import { ApiProperty } from '@nestjs/swagger';
import { Recipe } from '../entities/recipe.entity';

export class SaveRecipeResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Recipe saved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'When the recipe was saved',
    example: '2024-01-15T10:30:00Z',
  })
  savedAt: Date;
}

export class UnsaveRecipeResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Recipe unsaved successfully',
  })
  message: string;
}

export class ToggleSaveRecipeResponseDto {
  @ApiProperty({
    description: 'Whether the recipe is currently saved',
    example: true,
  })
  isSaved: boolean;

  @ApiProperty({
    description: 'Total number of users who saved this recipe',
    example: 15,
  })
  saveCount: number;

  @ApiProperty({
    description: 'Response message',
    example: 'Recipe saved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'When the recipe was saved (only if newly saved)',
    example: '2024-01-15T10:30:00Z',
    required: false,
  })
  savedAt?: Date;
}

export class CheckSaveStatusResponseDto {
  @ApiProperty({
    description: 'Whether the recipe is saved by the user',
    example: true,
  })
  isSaved: boolean;

  @ApiProperty({
    description: 'Total number of users who saved this recipe',
    example: 15,
  })
  saveCount: number;

  @ApiProperty({
    description: 'When the user saved the recipe (if saved)',
    example: '2024-01-15T10:30:00Z',
    required: false,
  })
  savedAt?: Date;
}

export class SavedRecipeWithDetailsDto {
  @ApiProperty({
    description: 'The saved recipe details',
    type: () => Recipe,
  })
  recipe: Recipe;

  @ApiProperty({
    description: 'When the recipe was saved',
    example: '2024-01-15T10:30:00Z',
  })
  savedAt: Date;
}

export class PaginationDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  totalPages: number;
}

export class GetUserSavedRecipesResponseDto {
  @ApiProperty({
    description: 'Array of saved recipes with details',
    type: [SavedRecipeWithDetailsDto],
  })
  data: SavedRecipeWithDetailsDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: PaginationDto,
  })
  pagination: PaginationDto;
}

export class SavedByUserDto {
  @ApiProperty({
    description: 'User ID',
    example: 'uuid-123',
  })
  id: string;

  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'User email',
    example: 'john@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'When the user saved the recipe',
    example: '2024-01-15T10:30:00Z',
  })
  savedAt: Date;
}

export class GetRecipeSaveDetailsResponseDto {
  @ApiProperty({
    description: 'Total number of saves for this recipe',
    example: 15,
  })
  saveCount: number;

  @ApiProperty({
    description: 'List of users who saved this recipe',
    type: [SavedByUserDto],
  })
  savedBy: SavedByUserDto[];

  @ApiProperty({
    description: 'Whether this recipe is considered popular',
    example: true,
  })
  isPopular: boolean;

  @ApiProperty({
    description: 'Popularity rank among all recipes',
    example: 5,
    required: false,
  })
  popularityRank?: number;
}

export class TopSavedRecipeDto {
  @ApiProperty({
    description: 'Recipe ID',
    example: 'uuid-123',
  })
  id: string;

  @ApiProperty({
    description: 'Recipe title',
    example: 'Chocolate Chip Cookies',
  })
  title: string;

  @ApiProperty({
    description: 'Number of saves',
    example: 89,
  })
  saveCount: number;

  @ApiProperty({
    description: 'Recipe author name',
    example: 'Chef Maria',
  })
  author: string;
}

export class PlatformSaveStatsResponseDto {
  @ApiProperty({
    description: 'Total number of saves across all recipes',
    example: 1250,
  })
  totalSaved: number;

  @ApiProperty({
    description: 'Number of saves this week',
    example: 45,
  })
  savedThisWeek: number;

  @ApiProperty({
    description: 'Number of saves this month',
    example: 180,
  })
  savedThisMonth: number;

  @ApiProperty({
    description: 'Top saved recipes',
    type: [TopSavedRecipeDto],
  })
  topSavedRecipes: TopSavedRecipeDto[];
}

export class RecentlySavedDto {
  @ApiProperty({
    description: 'Recipe ID',
    example: 'uuid-123',
  })
  id: string;

  @ApiProperty({
    description: 'Recipe title',
    example: 'Chocolate Cake',
  })
  title: string;

  @ApiProperty({
    description: 'When the recipe was saved',
    example: '2024-01-15T10:30:00Z',
  })
  savedAt: Date;
}

export class FavoriteCategoryDto {
  @ApiProperty({
    description: 'Cuisine type',
    example: 'Italian',
  })
  cuisine: string;

  @ApiProperty({
    description: 'Number of saved recipes in this category',
    example: 8,
  })
  count: number;
}

export class UserSaveActivityResponseDto {
  @ApiProperty({
    description: 'Total number of recipes saved by user',
    example: 25,
  })
  totalSaved: number;

  @ApiProperty({
    description: 'Recently saved recipes',
    type: [RecentlySavedDto],
  })
  recentlySaved: RecentlySavedDto[];

  @ApiProperty({
    description: 'User favorite cuisine categories',
    type: [FavoriteCategoryDto],
  })
  favoriteCategories: FavoriteCategoryDto[];
}

export class BulkOperationFailedDto {
  @ApiProperty({
    description: 'Recipe ID that failed',
    example: 'uuid-123',
  })
  recipeId: string;

  @ApiProperty({
    description: 'Error message',
    example: 'Recipe not found',
  })
  error: string;
}

export class BulkSaveResponseDto {
  @ApiProperty({
    description: 'Successfully processed recipe IDs',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
  })
  successful: string[];

  @ApiProperty({
    description: 'Failed operations with error details',
    type: [BulkOperationFailedDto],
  })
  failed: BulkOperationFailedDto[];

  @ApiProperty({
    description: 'Summary message',
    example: 'Processed 3 recipes. 2 successful, 1 failed.',
  })
  message: string;
}

export class SavedRecipesByUsersDto {
  @ApiProperty({
    description: 'Recipe details',
    type: () => Recipe,
  })
  recipe: Recipe;

  @ApiProperty({
    description: 'Number of specified users who saved this recipe',
    example: 3,
  })
  savedByCount: number;

  @ApiProperty({
    description: 'User IDs who saved this recipe',
    type: [String],
    example: ['user-1', 'user-2', 'user-3'],
  })
  savedByUsers: string[];
}

export class GetRecipesSavedByUsersResponseDto {
  @ApiProperty({
    description: 'Recipes saved by multiple users',
    type: [SavedRecipesByUsersDto],
  })
  data: SavedRecipesByUsersDto[];

  @ApiProperty({
    description: 'Total number of recipes found',
    example: 15,
  })
  total: number;
}
