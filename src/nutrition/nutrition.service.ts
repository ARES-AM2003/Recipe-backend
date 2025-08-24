import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull, MoreThan, LessThanOrEqual, Like } from 'typeorm';
import { Recipe } from '../recipes/entities/recipe.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { NutritionFiltersDto } from './dto/nutrition-filters.dto';

// Define interface for nutrition insights
export interface NutritionInsight {
  type: string;
  level: string;
  message: string;
}

type NutritionSummary = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
};

@Injectable()
export class NutritionService {
  private readonly logger = new Logger(NutritionService.name);

  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {}

  /**
   * Get recipes filtered by nutritional values
   */
  async getRecipesByNutrition(
    filters: NutritionFiltersDto,
    page = 1,
    limit = 10,
  ) {
    try {
      const skip = (page - 1) * limit;
      
      // Build the base query
      const query = this.recipeRepository
        .createQueryBuilder('recipe')
        .where('1=1')
        .orderBy('recipe.averageRating', 'DESC')
        .skip(skip)
        .take(limit);
      
      // Apply nutritional filters
      if (filters.maxCalories !== undefined) {
        query.andWhere('recipe.calories <= :maxCalories', { maxCalories: filters.maxCalories });
      }
      
      if (filters.minProtein !== undefined) {
        query.andWhere('recipe.protein >= :minProtein', { minProtein: filters.minProtein });
      }
      
      if (filters.maxCarbs !== undefined) {
        query.andWhere('recipe.carbs <= :maxCarbs', { maxCarbs: filters.maxCarbs });
      }
      
      if (filters.maxFat !== undefined) {
        query.andWhere('recipe.fat <= :maxFat', { maxFat: filters.maxFat });
      }
      
      if (filters.minFiber !== undefined) {
        query.andWhere('recipe.fiber >= :minFiber', { minFiber: filters.minFiber });
      }
      
      if (filters.maxSugar !== undefined) {
        query.andWhere('recipe.sugar <= :maxSugar', { maxSugar: filters.maxSugar });
      }
      
      if (filters.maxSodium !== undefined) {
        query.andWhere('recipe.sodium <= :maxSodium', { maxSodium: filters.maxSodium });
      }
      
      // Apply dietary restrictions
      if (filters.dietaryRestrictions?.length) {
        filters.dietaryRestrictions.forEach(restriction => {
          query.andWhere(`LOWER(recipe.dietaryInfo) LIKE LOWER(:${restriction}Restriction)`, 
            { [`${restriction}Restriction`]: `%${restriction}%` }
          );
        });
      }
      
      // Apply time-based filters
      if (filters.maxPrepTime !== undefined) {
        query.andWhere('recipe.prepTime <= :maxPrepTime', { maxPrepTime: filters.maxPrepTime });
      }
      
      if (filters.maxCookTime !== undefined) {
        query.andWhere('recipe.cookTime <= :maxCookTime', { maxCookTime: filters.maxCookTime });
      }
      
      // Execute the query
      const [recipes, total] = await query.getManyAndCount();
      
      // If allergen filtering is needed, we need to do it in-memory
      // since it requires checking ingredient relationships
      let filteredRecipes = recipes;
      if (filters.excludeAllergens?.length) {
        // Get all recipes with their ingredients
        const recipesWithIngredients = await this.recipeRepository.find({
          where: { id: In(recipes.map(r => r.id)) },
          relations: ['ingredients'],
        });
        
        // Get all ingredients that match the excluded allergens
        const allergenIngredients = await this.ingredientRepository.find({
          where: filters.excludeAllergens.map(allergen => ({
            name: Like(`%${allergen}%`),
          })),
        });
        
        // Filter out recipes that contain excluded allergens
        filteredRecipes = recipesWithIngredients.filter(recipe => 
          !recipe.ingredients.some(ingredient => 
            allergenIngredients.some(allergen => allergen.id === ingredient.id)
          )
        );
        
        // Map back to the original recipe objects without the relations
        filteredRecipes = filteredRecipes.map(r => ({
          ...r,
          ingredients: [], // Remove the relations we just added
        }));
      }
      
      return {
        data: filteredRecipes,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error filtering recipes by nutrition', error.stack);
      throw error;
    }
  }
  
  /**
   * Calculate nutritional summary for a list of recipes
   */
  calculateNutritionalSummary(recipes: Recipe[]): NutritionSummary {
    return recipes.reduce(
      (summary, recipe) => ({
        calories: summary.calories + (recipe.calories || 0) * (recipe.servings || 1),
        protein: summary.protein + (recipe.protein || 0) * (recipe.servings || 1),
        carbs: summary.carbs + (recipe.carbs || 0) * (recipe.servings || 1),
        fat: summary.fat + (recipe.fat || 0) * (recipe.servings || 1),
        fiber: summary.fiber + (recipe.fiber || 0) * (recipe.servings || 1),
        sugar: summary.sugar + (recipe.sugar || 0) * (recipe.servings || 1),
        sodium: summary.sodium + (recipe.sodium || 0) * (recipe.servings || 1),
      }),
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
      },
    );
  }
  
  /**
   * Get nutritional insights based on user's recipes and preferences
   */
  async getNutritionalInsights(userId: string) {
    try {
      // Get user's liked/saved recipes
      const userRecipes = await this.recipeRepository.find({
        where: { likedBy: { id: userId } },
      });
      
      if (userRecipes.length === 0) {
        return {
          message: 'Not enough data to generate insights. Save or like some recipes first.',
        };
      }
      
      // Calculate nutritional summary
      const summary = this.calculateNutritionalSummary(userRecipes);
      const recipeCount = userRecipes.length;
      
      // Calculate averages per recipe
      const avgPerRecipe = {
        calories: summary.calories / recipeCount,
        protein: summary.protein / recipeCount,
        carbs: summary.carbs / recipeCount,
        fat: summary.fat / recipeCount,
        fiber: summary.fiber / recipeCount,
        sugar: summary.sugar / recipeCount,
        sodium: summary.sodium / recipeCount,
      };
      
      // Generate insights
      const insights: NutritionInsight[] = [];
      
      // Protein insight
      const proteinPerMeal = avgPerRecipe.protein;
      if (proteinPerMeal < 15) {
        insights.push({
          type: 'protein',
          level: 'low',
          message: 'Your recipes are relatively low in protein. Consider adding more protein-rich ingredients like chicken, fish, beans, or tofu.',
        });
      } else if (proteinPerMeal > 40) {
        insights.push({
          type: 'protein',
          level: 'high',
          message: 'Your recipes are high in protein, which is great for muscle maintenance and satiety.',
        });
      }
      
      // Fiber insight
      if (avgPerRecipe.fiber < 5) {
        insights.push({
          type: 'fiber',
          level: 'low',
          message: 'Your recipes could use more fiber. Try adding more vegetables, fruits, whole grains, and legumes.',
        });
      } else if (avgPerRecipe.fiber > 15) {
        insights.push({
          type: 'fiber',
          level: 'high',
          message: 'Your recipes are high in fiber, which is excellent for digestive health.',
        });
      }
      
      // Sugar insight
      if (avgPerRecipe.sugar > 25) {
        insights.push({
          type: 'sugar',
          level: 'high',
          message: 'Your recipes are relatively high in sugar. Consider reducing added sugars where possible.',
        });
      }
      
      // Sodium insight
      if (avgPerRecipe.sodium > 800) {
        insights.push({
          type: 'sodium',
          level: 'high',
          message: 'Your recipes are relatively high in sodium. Consider using herbs and spices for flavor instead of salt.',
        });
      }
      
      // Balance insight
      const carbPercentage = (avgPerRecipe.carbs * 4) / (avgPerRecipe.calories || 1) * 100;
      const proteinPercentage = (avgPerRecipe.protein * 4) / (avgPerRecipe.calories || 1) * 100;
      const fatPercentage = (avgPerRecipe.fat * 9) / (avgPerRecipe.calories || 1) * 100;
      
      if (carbPercentage > 60 && fatPercentage < 20) {
        insights.push({
          type: 'macronutrient_balance',
          level: 'info',
          message: 'Your recipes are relatively high in carbohydrates and low in fat. Consider adding some healthy fats like avocados, nuts, or olive oil.',
        });
      } else if (fatPercentage > 40 && carbPercentage < 30) {
        insights.push({
          type: 'macronutrient_balance',
          level: 'info',
          message: 'Your recipes are relatively high in fat and low in carbohydrates. This might be intentional if you\'re following a low-carb or ketogenic diet.',
        });
      }
      
      return {
        summary: {
          totalRecipes: recipeCount,
          totalCalories: summary.calories,
          averagePerRecipe: avgPerRecipe,
          macronutrientDistribution: {
            carbs: parseFloat(carbPercentage.toFixed(1)),
            protein: parseFloat(proteinPercentage.toFixed(1)),
            fat: parseFloat(fatPercentage.toFixed(1)),
          },
        },
        insights,
        recommendations: [
          'Try to include a variety of colorful vegetables in your meals.',
          'Consider adding a source of healthy fats like nuts, seeds, or avocados.',
          'Stay hydrated by drinking plenty of water throughout the day.',
        ],
      };
    } catch (error) {
      this.logger.error('Error generating nutritional insights', error.stack);
      throw error;
    }
  }
  
  /**
   * Get nutritional goals based on user profile
   */
  getNutritionalGoals(user: any) {
    // This is a simplified example - in a real app, this would be based on
    // user's profile, goals, activity level, etc.
    const baseCalories = 2000; // Default calorie goal
    
    return {
      calories: baseCalories,
      protein: Math.round(baseCalories * 0.2 / 4), // 20% of calories from protein
      carbs: Math.round(baseCalories * 0.5 / 4),   // 50% of calories from carbs
      fat: Math.round(baseCalories * 0.3 / 9),     // 30% of calories from fat
      fiber: 25, // grams
      sugar: 50,  // grams (ideally <10% of total calories)
      sodium: 2300, // mg
    };
  }
}
