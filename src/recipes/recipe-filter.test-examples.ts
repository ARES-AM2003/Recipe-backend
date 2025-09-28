/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Recipe Filter API Test Examples
 *
 * This file contains example usage of the FilterRecipesDto and demonstrates
 * how to construct various filter combinations for testing the /recipes/filter endpoint.
 *
 * Note: This is for documentation and testing purposes only.
 */

import { FilterRecipesDto, TimeCategory, SortOption } from './dto/filter-recipes.dto';
import { CuisineType, DifficultyLevel, MealType } from './entities/recipe.entity';

// Example 1: Basic search with cuisine filter
const basicSearchExample: FilterRecipesDto = {
  search: 'pasta',
  cuisine: [CuisineType.ITALIAN],
  difficulty: [DifficultyLevel.EASY],
  page: 1,
  limit: 10,
  sort: SortOption.RATING_DESC,
};

// Example 2: Quick healthy dinner recipes
const quickHealthyDinnerExample: FilterRecipesDto = {
  mealType: [MealType.DINNER],
  timeCategory: TimeCategory.QUICK,
  caloriesMax: 400,
  proteinMin: 15,
  fatMax: 12,
  sort: SortOption.RATING_DESC,
};

// Example 3: Vegetarian low-carb options
const vegetarianLowCarbExample: FilterRecipesDto = {
  ingredientsExclude: ['meat', 'chicken', 'beef', 'pork', 'fish'],
  carbsMax: 20,
  minRating: 3.5,
  fiberMin: 8,
  sort: SortOption.NEWEST,
};

// Example 4: High-protein breakfast under 30 minutes
const quickHighProteinBreakfastExample: FilterRecipesDto = {
  mealType: [MealType.BREAKFAST],
  prepTimeMax: 30,
  proteinMin: 20,
  caloriesMin: 250,
  sort: SortOption.TIME_ASC,
};

// Example 5: Mediterranean diet recipes
const mediterraneanDietExample: FilterRecipesDto = {
  cuisine: [CuisineType.MEDITERRANEAN],
  ingredientsInclude: ['olive oil', 'tomato'],
  ingredientsExclude: ['processed meat'],
  fatMax: 25,
  fiberMin: 5,
  sodiumMax: 1.5,
};

// Example 6: Family-friendly Italian recipes
const familyFriendlyItalianExample: FilterRecipesDto = {
  cuisine: [CuisineType.ITALIAN],
  difficulty: [DifficultyLevel.EASY, DifficultyLevel.MEDIUM],
  servingsMin: 4,
  ingredientsExclude: ['nuts', 'shellfish'],
  cookTimeMax: 45,
  sort: SortOption.MOST_REVIEWED,
};

// Example 7: Diet-conscious recipes
const dietConsciousExample: FilterRecipesDto = {
  caloriesMax: 300,
  fatMax: 10,
  sodiumMax: 0.8,
  sugarMax: 8,
  fiberMin: 6,
  minRating: 4.0,
  sort: SortOption.RATING_DESC,
  limit: 20,
};

// Example 8: Advanced multi-cuisine filter
const multiCuisineExample: FilterRecipesDto = {
  cuisine: [CuisineType.INDIAN, CuisineType.THAI, CuisineType.CHINESE],
  mealType: [MealType.LUNCH, MealType.DINNER],
  difficulty: [DifficultyLevel.MEDIUM],
  ingredientsInclude: ['ginger', 'garlic'],
  ingredientsExclude: ['dairy'],
  prepTimeMax: 20,
  cookTimeMax: 40,
  caloriesMin: 300,
  caloriesMax: 600,
  sort: SortOption.TIME_ASC,
};

// Example 9: Time-specific filters with nutrition constraints
const timeAndNutritionExample: FilterRecipesDto = {
  timeCategory: TimeCategory.MODERATE,
  proteinMin: 25,
  carbsMax: 35,
  fatMax: 15,
  fiberMin: 10,
  minRating: 4.2,
  servingsMin: 2,
  page: 1,
  limit: 15,
};

// Example 10: Dessert and snack options
const dessertSnackExample: FilterRecipesDto = {
  mealType: [MealType.DESSERT, MealType.SNACK],
  caloriesMax: 250,
  sugarMax: 15,
  prepTimeMax: 30,
  difficulty: [DifficultyLevel.EASY],
  sort: SortOption.RATING_DESC,
};

// Example 11: Complete nutrition profile filter
const completeNutritionExample: FilterRecipesDto = {
  search: 'salmon',
  caloriesMin: 400,
  caloriesMax: 700,
  proteinMin: 30,
  carbsMax: 40,
  fatMax: 20,
  fiberMin: 8,
  sugarMax: 12,
  sodiumMax: 1.2,
  minRating: 4.0,
  servingsMin: 3,
  sort: SortOption.RATING_DESC,
};

// Example 12: Ingredient-focused filter with UUIDs
const ingredientUuidExample: FilterRecipesDto = {
  ingredientsInclude: [
    '123e4567-e89b-12d3-a456-426614174000', // Example UUID for chicken
    '987fcdeb-51a2-43d1-9c47-123456789abc', // Example UUID for rice
  ],
  ingredientsExclude: ['nuts', 'shellfish'],
  difficulty: [DifficultyLevel.EASY, DifficultyLevel.MEDIUM],
  cookTimeMax: 60,
};

// Example 13: Comprehensive filter combining all aspects
const comprehensiveExample: FilterRecipesDto = {
  search: 'healthy bowl',
  cuisine: [CuisineType.MEDITERRANEAN, CuisineType.AMERICAN],
  mealType: [MealType.LUNCH, MealType.DINNER],
  difficulty: [DifficultyLevel.EASY, DifficultyLevel.MEDIUM],
  timeCategory: TimeCategory.MODERATE,
  servingsMin: 2,
  ingredientsInclude: ['quinoa', 'vegetables'],
  ingredientsExclude: ['gluten', 'dairy'],
  caloriesMin: 300,
  caloriesMax: 500,
  proteinMin: 15,
  carbsMax: 45,
  fatMax: 18,
  fiberMin: 8,
  sugarMax: 10,
  sodiumMax: 1.0,
  minRating: 3.8,
  page: 1,
  limit: 25,
  sort: SortOption.RATING_DESC,
};

// Test query parameter examples as they would appear in URLs
export const urlExamples = {
  basicSearch: '/recipes/filter?search=pasta&cuisine=Italian&difficulty=Easy&sort=rating_desc',
  quickHealthy: '/recipes/filter?mealType=Dinner&timeCategory=quick&caloriesMax=400&proteinMin=15&sort=rating_desc',
  vegetarianLowCarb: '/recipes/filter?ingredientsExclude=meat,chicken,beef,pork&carbsMax=20&minRating=3.5',
  highProteinBreakfast: '/recipes/filter?mealType=Breakfast&prepTimeMax=30&proteinMin=20&sort=time_asc',
  mediterranean: '/recipes/filter?cuisine=Mediterranean&ingredientsInclude=olive%20oil,tomato&fatMax=25&fiberMin=5',
  familyFriendly: '/recipes/filter?cuisine=Italian&difficulty=Easy,Medium&servingsMin=4&ingredientsExclude=nuts,shellfish&sort=most_reviewed',
  dietConscious: '/recipes/filter?caloriesMax=300&fatMax=10&sodiumMax=0.8&sugarMax=8&minRating=4.0&limit=20',
  multiCuisine: '/recipes/filter?cuisine=Indian,Thai,Chinese&mealType=Lunch,Dinner&difficulty=Medium&ingredientsInclude=ginger,garlic',
  comprehensive: '/recipes/filter?search=healthy%20bowl&cuisine=Mediterranean,American&mealType=Lunch,Dinner&timeCategory=moderate&servingsMin=2&ingredientsInclude=quinoa,vegetables&ingredientsExclude=gluten,dairy&caloriesMin=300&caloriesMax=500&proteinMin=15&carbsMax=45&fatMax=18&fiberMin=8&sugarMax=10&sodiumMax=1.0&minRating=3.8&limit=25&sort=rating_desc',
};

// Helper function to convert DTO to query string (for testing purposes)
export function dtoToQueryString(dto: FilterRecipesDto): string {
  const params = new URLSearchParams();

  Object.entries(dto).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        params.append(key, value.join(','));
      } else {
        params.append(key, value.toString());
      }
    }
  });

  return params.toString();
}

// Example usage of the helper function
export const generatedQueryStrings = {
  basicSearch: dtoToQueryString(basicSearchExample),
  quickHealthyDinner: dtoToQueryString(quickHealthyDinnerExample),
  vegetarianLowCarb: dtoToQueryString(vegetarianLowCarbExample),
  comprehensive: dtoToQueryString(comprehensiveExample),
};

// Validation examples - these would fail validation
export const invalidExamples = {
  // Invalid rating (over 5.0)
  invalidRating: {
    minRating: 6.0,
  } as FilterRecipesDto,

  // Invalid page (less than 1)
  invalidPage: {
    page: 0,
  } as FilterRecipesDto,

  // Invalid limit (over 100)
  invalidLimit: {
    limit: 150,
  } as FilterRecipesDto,

  // Invalid time values (negative)
  invalidTime: {
    prepTimeMin: -10,
    cookTimeMax: -5,
  } as FilterRecipesDto,
};

/**
 * Usage Instructions:
 *
 * 1. Import the examples in your test files
 * 2. Use them as request body or query parameters
 * 3. Test various combinations to ensure filtering works correctly
 * 4. Validate that only provided parameters are applied to the query
 * 5. Check that the response format matches the expected structure
 *
 * Example test:
 * ```typescript
 * import { basicSearchExample } from './recipe-filter.test-examples';
 *
 * const response = await request(app)
 *   .get('/recipes/filter')
 *   .query(basicSearchExample)
 *   .expect(200);
 *
 * expect(response.body.data).toBeDefined();
 * expect(response.body.total).toBeGreaterThanOrEqual(0);
 * ```
 */
