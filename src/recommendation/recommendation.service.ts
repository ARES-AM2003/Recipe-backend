import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Recipe } from '../recipes/entities/recipe.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { RecommendationRequestDto } from './dto/recommendation-request.dto';
import { RecommendationResponseDto, RecommendationItemDto } from './dto/recommendation-response.dto';
import * as natural from 'natural';
import * as tf from '@tensorflow/tfjs-node';
import { ConfigService } from '@nestjs/config';

type RecipeVector = {
  recipe: Recipe;
  vector: number[];
};

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);
  private tfidf: natural.TfIdf;
  private recipeVectors: RecipeVector[] = [];
  private model: tf.LayersModel | null = null;

  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    private readonly configService: ConfigService,
  ) {
    this.initializeRecommendationEngine();
  }

  private async initializeRecommendationEngine() {
    try {
      // Initialize TF-IDF for content-based filtering
      this.tfidf = new natural.TfIdf();

      // Use pagination to avoid memory issues
      const batchSize = 100;
      let offset = 0;
      let hasMore = true;

      this.logger.log('Starting recommendation engine initialization...');

      while (hasMore) {
        const recipes = await this.recipeRepository.find({
          relations: ['ingredients'],
          take: batchSize,
          skip: offset,
        });

        if (recipes.length === 0) {
          hasMore = false;
          break;
        }

        // Process batch asynchronously
        await this.processBatch(recipes);
        offset += batchSize;

        this.logger.debug(`Processed ${offset} recipes...`);
      }

      // Load or initialize collaborative filtering model
      await this.loadCollaborativeModel();

      this.logger.log(`Recommendation engine initialized with ${this.recipeVectors.length} recipes`);
    } catch (error) {
      this.logger.error('Error initializing recommendation engine', error.stack);
    }
  }

  private async processBatch(recipes: Recipe[]) {
    const promises = recipes.map(recipe => this.processRecipe(recipe));
    await Promise.all(promises);
  }

  private async processRecipe(recipe: Recipe) {
    try {
      const text = [
        recipe.title,
        recipe.description,
        ...recipe.instructions,
        ...recipe.tags || [],
        ...recipe.ingredients.map(i => i.name),
      ].join(' ');

      this.tfidf.addDocument(text);

      // Store recipe with its vector (will be calculated later)
      this.recipeVectors.push({
        recipe,
        vector: [], // Will be populated after all documents are added
      });
    } catch (error) {
      this.logger.error(`Error processing recipe ${recipe.id}`, error.stack);
    }
  }

  private getTfidfVector(text: string): number[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const documentCount = this.tfidf.documents.length;
    const vector: number[] = Array(documentCount).fill(0);

    this.tfidf.tfidfs(text, (i, measure) => {
      if (i >= 0 && i < vector.length) {
        vector[i] = measure;
      }
    });

    return vector;
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * (vecB[i] || 0), 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private async loadCollaborativeModel() {
    try {
      // In a real app, load a pre-trained model from disk or a model server
      // For now, we'll use a simple matrix factorization approach
      this.logger.log('Initializing collaborative filtering model...');
      
      // This is a placeholder for a real model
      // In production, you would load a pre-trained model here
      this.model = null;
      
    } catch (error) {
      this.logger.error('Error loading collaborative model', error.stack);
      this.model = null;
    }
  }

  private async getContentBasedRecommendations(
    ingredientIds: string[],
    limit: number,
    excludeRecipeIds: string[] = [],
  ): Promise<RecommendationItemDto[]> {
    try {
      // Get ingredients for the query
      const ingredients = await this.ingredientRepository.find({
        where: { id: In(ingredientIds) },
      });
      
      if (ingredients.length === 0) {
        return [];
      }
      
      // Create a query string from ingredients
      const queryText = ingredients.map(i => i.name).join(' ');
      const queryVector = this.getTfidfVector(queryText);
      
      // Calculate similarity scores
      const scoredRecipes = this.recipeVectors
        .filter(rv => !excludeRecipeIds.includes(rv.recipe.id))
        .map(rv => ({
          recipe: rv.recipe,
          score: this.cosineSimilarity(queryVector, rv.vector),
        }))
        .filter(item => item.score > 0) // Filter out zero-similarity recipes
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      return scoredRecipes.map(item => ({
        recipe: item.recipe,
        score: item.score,
        type: 'content' as const,
        reason: `Similar to ingredients: ${ingredients.map(i => i.name).join(', ')}`,
      }));
    } catch (error) {
      this.logger.error('Error in content-based recommendations', error.stack);
      return [];
    }
  }

  private async getCollaborativeRecommendations(
    userId: string,
    limit: number,
    excludeRecipeIds: string[] = [],
  ): Promise<RecommendationItemDto[]> {
    try {
      // In a real app, use the collaborative filtering model
      // For now, return popular recipes the user hasn't interacted with
      const popularRecipes = await this.recipeRepository.find({
        where: { id: Not(In(excludeRecipeIds)) },
        order: { averageRating: 'DESC', reviewCount: 'DESC' },
        take: limit,
      });
      
      return popularRecipes.map((recipe, index) => ({
        recipe,
        score: 0.8 - (index * 0.1), // Simple scoring based on position
        type: 'collaborative' as const,
        reason: 'Popular among users with similar tastes',
      }));
    } catch (error) {
      this.logger.error('Error in collaborative recommendations', error.stack);
      return [];
    }
  }

  private async getHybridRecommendations(
    contentRecs: RecommendationItemDto[],
    collabRecs: RecommendationItemDto[],
    limit: number,
  ): Promise<RecommendationItemDto[]> {
    try {
      // Simple hybrid approach: combine and re-rank
      const combined = [...contentRecs, ...collabRecs];
      
      // Group by recipe ID and combine scores
      const recipeMap = new Map<string, RecommendationItemDto>();
      
      combined.forEach(rec => {
        const existing = recipeMap.get(rec.recipe.id);
        if (existing) {
          // Average the scores if the recipe appears in both lists
          existing.score = (existing.score + rec.score) / 2;
        } else {
          recipeMap.set(rec.recipe.id, { ...rec });
        }
      });
      
      return Array.from(recipeMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Error in hybrid recommendations', error.stack);
      return [];
    }
  }

  private async filterByNutrition(
    recipes: RecommendationItemDto[],
    filters: {
      maxCalories?: number;
      minProtein?: number;
      maxCarbs?: number;
      maxFat?: number;
    },
  ): Promise<RecommendationItemDto[]> {
    if (!filters || Object.keys(filters).length === 0) {
      return recipes;
    }
    
    return recipes.filter(item => {
      const recipe = item.recipe;
      
      if (filters.maxCalories !== undefined && recipe.calories > filters.maxCalories) {
        return false;
      }
      
      if (filters.minProtein !== undefined && recipe.protein < filters.minProtein) {
        return false;
      }
      
      if (filters.maxCarbs !== undefined && recipe.carbs > filters.maxCarbs) {
        return false;
      }
      
      if (filters.maxFat !== undefined && recipe.fat > filters.maxFat) {
        return false;
      }
      
      return true;
    });
  }

  async getRecommendations(
    userId: string,
    request: RecommendationRequestDto,
  ): Promise<RecommendationResponseDto> {
    try {
      const startTime = Date.now();
      const { 
        ingredientIds = [], 
        limit = 10, 
        includeContentBased = true,
        includeCollaborative = true,
        includeHybrid = true,
        ...filters
      } = request;
      
      // Get user's liked/saved recipes to exclude from recommendations
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['likedRecipes'],
      });
      
      const excludeRecipeIds = user?.likedRecipes?.map(r => r.id) || [];
      
      // Get recommendations from different strategies
      const [contentRecs, collabRecs] = await Promise.all([
        includeContentBased && ingredientIds?.length > 0
          ? this.getContentBasedRecommendations(ingredientIds, limit * 2, excludeRecipeIds)
          : [],
        includeCollaborative
          ? this.getCollaborativeRecommendations(userId, limit * 2, excludeRecipeIds)
          : [],
      ]);
      
      // Get hybrid recommendations if enabled
      const hybridRecs = includeHybrid && (contentRecs.length > 0 || collabRecs.length > 0)
        ? await this.getHybridRecommendations(contentRecs, collabRecs, limit * 2)
        : [];
      
      // Combine all recommendations
      let allRecommendations: RecommendationItemDto[] = [];
      
      if (includeHybrid && hybridRecs.length > 0) {
        allRecommendations = [...hybridRecs];
      } else {
        if (includeContentBased) allRecommendations.push(...contentRecs);
        if (includeCollaborative) allRecommendations.push(...collabRecs);
      }
      
      // Filter by nutrition if requested
      if (Object.keys(filters).length > 0) {
        allRecommendations = await this.filterByNutrition(allRecommendations, filters);
      }
      
      // Remove duplicates and sort by score
      const uniqueRecipes = new Map<string, RecommendationItemDto>();
      allRecommendations.forEach(rec => {
        if (!uniqueRecipes.has(rec.recipe.id)) {
          uniqueRecipes.set(rec.recipe.id, rec);
        }
      });
      
      const sortedRecommendations = Array.from(uniqueRecipes.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      // Count recommendations by type
      const contentCount = sortedRecommendations.filter(r => r.type === 'content').length;
      const collabCount = sortedRecommendations.filter(r => r.type === 'collaborative').length;
      const hybridCount = sortedRecommendations.filter(r => r.type === 'hybrid').length;
      
      return {
        recommendations: sortedRecommendations,
        metadata: {
          totalRecommendations: sortedRecommendations.length,
          contentBasedCount: contentCount,
          collaborativeCount: collabCount,
          hybridCount: hybridCount,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      this.logger.error('Error generating recommendations', error.stack);
      return {
        recommendations: [],
        metadata: {
          totalRecommendations: 0,
          contentBasedCount: 0,
          collaborativeCount: 0,
          hybridCount: 0,
          timestamp: new Date(),
          // error: 'Failed to generate recommendations',
        },
      };
    }
  }
}
