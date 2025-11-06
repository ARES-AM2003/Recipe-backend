import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Recipe } from '../recipes/entities/recipe.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { CustomTfIdf } from './custom-tfidf';
import {
  CustomRecommendationRequestDto,
  CustomRecommendationResponseDto,
  CustomRecommendationItemDto,
} from './dto/custom-recommendation.dto';

interface RecipeVector {
  recipe: Recipe;
  vector: number[];
  sparseVector: Map<string, number>;
}

@Injectable()
export class RecommendationCustomService implements OnModuleInit {
  private readonly logger = new Logger(RecommendationCustomService.name);
  private customTfidf: CustomTfIdf;
  private recipeVectors: RecipeVector[] = [];
  private vocabulary: string[] = [];
  private isInitialized = false;

  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {}

  async onModuleInit() {
    await this.initializeCustomTfIdf();
  }

  /**
   * Initialize the custom TF-IDF model with all recipes
   * This can be called to refresh the model when new recipes are added
   */
  async initializeCustomTfIdf() {
    try {
      this.logger.log('🚀 Initializing Custom TF-IDF recommendation engine...');
      const startTime = Date.now();

      // Initialize the custom TF-IDF instance
      this.customTfidf = new CustomTfIdf();

      // Load all recipes with their ingredients
      const recipes = await this.recipeRepository.find({
        relations: ['ingredients'],
      });

      this.logger.log(`📚 Loaded ${recipes.length} recipes from database`);

      // Add each recipe as a document to the TF-IDF model
      for (const recipe of recipes) {
        const text = this.buildRecipeDocument(recipe);
        this.customTfidf.addDocument(text);
      }

      // Get the vocabulary (all unique terms)
      this.vocabulary = this.customTfidf.getVocabulary();

      this.logger.log(
        `📖 Vocabulary size: ${this.vocabulary.length} unique terms`,
      );

      // Calculate vectors for all recipes
      await this.calculateRecipeVectors(recipes);

      const duration = Date.now() - startTime;
      this.isInitialized = true;

      this.logger.log(
        `✅ Custom TF-IDF engine initialized in ${duration}ms with ${recipes.length} recipes`,
      );

      return {
        success: true,
        recipeCount: recipes.length,
        vocabularySize: this.vocabulary.length,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Error initializing custom TF-IDF engine',
        error?.stack || error,
      );
      throw error;
    }
  }

  /**
   * Build a text document from a recipe for TF-IDF processing
   */
  private buildRecipeDocument(recipe: Recipe): string {
    const parts = [
      recipe.title,
      recipe.description || '',
      ...(recipe.instructions || []),
      ...(recipe.tags || []),
      ...recipe.ingredients.map((i) => i.name),
    ];

    return parts.join(' ');
  }

  /**
   * Calculate TF-IDF vectors for all recipes
   */
  private calculateRecipeVectors(recipes: Recipe[]) {
    this.logger.log('📊 Calculating TF-IDF vectors for all recipes...');

    this.recipeVectors = recipes.map((recipe, index) => {
      // Get sparse vector (Map of term -> score)
      const sparseVector = this.customTfidf.getVector(index);

      // Get dense vector (aligned with vocabulary)
      const denseVector = this.customTfidf.getDenseVector(index);

      return {
        recipe,
        vector: denseVector,
        sparseVector,
      };
    });

    this.logger.log(
      `✅ Calculated vectors for ${this.recipeVectors.length} recipes`,
    );
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error(
        'Vectors must have the same length for cosine similarity',
      );
    }

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Create a query vector from ingredient IDs
   */
  private async createQueryVector(ingredientIds: string[]): Promise<number[]> {
    // Get ingredients from database
    const ingredients = await this.ingredientRepository.find({
      where: { id: In(ingredientIds) },
    });

    if (ingredients.length === 0) {
      this.logger.warn('No valid ingredients found for the given IDs');
      return new Array(this.vocabulary.length).fill(0);
    }

    this.logger.log(
      `🔍 Creating query vector from ${ingredients.length} ingredients: ${ingredients.map((i) => i.name).join(', ')}`,
    );

    // Build a query document
    const queryText = ingredients.map((i) => i.name).join(' ');

    // Create a temporary TF-IDF instance with both corpus and query
    const tempTfidf = new CustomTfIdf();

    // Add all original documents first
    for (let i = 0; i < this.customTfidf.documentCount; i++) {
      tempTfidf.addDocument(this.customTfidf.getDocumentText(i));
    }

    // Add the query as the last document
    tempTfidf.addDocument(queryText);

    // Get the vector for the query (last document)
    const queryVector = tempTfidf.getDenseVector(tempTfidf.documentCount - 1);

    return queryVector;
  }

  /**
   * Get recommendations using custom TF-IDF
   */
  async getRecommendations(
    userId: string,
    request: CustomRecommendationRequestDto,
  ): Promise<CustomRecommendationResponseDto> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        this.logger.warn('TF-IDF not initialized, initializing now...');
        await this.initializeCustomTfIdf();
      }

      const {
        ingredientIds = [],
        limit = 10,
        minCosineSimilarity = 0.6,
        maxCalories,
        minProtein,
        maxCarbs,
        maxFat,
      } = request;

      this.logger.log(
        `🔍 Getting recommendations for user ${userId} with ${ingredientIds.length} ingredients`,
      );

      // Get user's liked recipes to exclude
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['likedRecipes'],
      });

      const excludeRecipeIds = user?.likedRecipes?.map((r) => r.id) || [];

      // Create query vector from ingredients
      const queryVector = await this.createQueryVector(ingredientIds);

      // Calculate similarity scores for all recipes
      const scoredRecipes = this.recipeVectors
        .filter((rv) => !excludeRecipeIds.includes(rv.recipe.id))
        .map((rv) => {
          const similarity = this.cosineSimilarity(queryVector, rv.vector);

          return {
            recipe: rv.recipe,
            score: similarity,
          };
        })
        .filter((item) => {
          // Filter by minimum similarity
          if (item.score < minCosineSimilarity) {
            this.logger.debug(
              `[Filter] ${item.recipe.title}: ${item.score.toFixed(3)} < ${minCosineSimilarity} ❌`,
            );
            return false;
          }

          // Filter by nutrition
          if (maxCalories && item.recipe.calories > maxCalories) return false;
          if (minProtein && item.recipe.protein < minProtein) return false;
          if (maxCarbs && item.recipe.carbs > maxCarbs) return false;
          if (maxFat && item.recipe.fat > maxFat) return false;

          this.logger.debug(
            `[Filter] ${item.recipe.title}: ${item.score.toFixed(3)} >= ${minCosineSimilarity} ✅`,
          );

          return true;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Convert to response DTOs
      const recommendations: CustomRecommendationItemDto[] = scoredRecipes.map(
        (item) => ({
          recipe: item.recipe,
          score: item.score,
          reason: `Custom TF-IDF cosine similarity: ${item.score.toFixed(3)}`,
          type: 'custom-tfidf',
        }),
      );

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `✅ Generated ${recommendations.length} recommendations in ${processingTime}ms`,
      );

      return {
        recommendations,
        metadata: {
          totalRecommendations: recommendations.length,
          corpusSize: this.customTfidf.documentCount,
          vocabularySize: this.customTfidf.vocabularyLength,
          processingTimeMs: processingTime,
          timestamp: new Date(),
        },
      };
    } catch (error: any) {
      this.logger.error(
        'Error generating recommendations',
        error?.stack || error,
      );
      throw error;
    }
  }

  /**
   * Get TF-IDF details for a specific recipe
   */
  async getRecipeTfIdfDetails(recipeId: string): Promise<any> {
    if (!this.isInitialized) {
      await this.initializeCustomTfIdf();
    }

    const recipeVector = this.recipeVectors.find(
      (rv) => rv.recipe.id === recipeId,
    );

    if (!recipeVector) {
      throw new Error(`Recipe with ID ${recipeId} not found`);
    }

    const index = this.recipeVectors.indexOf(recipeVector);
    const terms = this.customTfidf.listTerms(index);

    return {
      recipe: {
        id: recipeVector.recipe.id,
        title: recipeVector.recipe.title,
      },
      topTerms: terms.slice(0, 20), // Top 20 most important terms
      vocabularySize: this.vocabulary.length,
    };
  }

  /**
   * Compare two recipes using custom TF-IDF
   */
  async compareRecipes(recipeId1: string, recipeId2: string): Promise<any> {
    if (!this.isInitialized) {
      await this.initializeCustomTfIdf();
    }

    const rv1 = this.recipeVectors.find((rv) => rv.recipe.id === recipeId1);
    const rv2 = this.recipeVectors.find((rv) => rv.recipe.id === recipeId2);

    if (!rv1 || !rv2) {
      throw new Error('One or both recipes not found');
    }

    const similarity = this.cosineSimilarity(rv1.vector, rv2.vector);

    return {
      recipe1: {
        id: rv1.recipe.id,
        title: rv1.recipe.title,
      },
      recipe2: {
        id: rv2.recipe.id,
        title: rv2.recipe.title,
      },
      cosineSimilarity: similarity,
      method: 'Custom TF-IDF',
    };
  }

  /**
   * Get statistics about the TF-IDF model
   */
  getModelStats() {
    if (!this.isInitialized) {
      return {
        initialized: false,
        message: 'Model not yet initialized',
      };
    }

    return {
      initialized: true,
      documentCount: this.customTfidf.documentCount,
      vocabularySize: this.customTfidf.vocabularyLength,
      recipeCount: this.recipeVectors.length,
      sampleVocabulary: this.vocabulary.slice(0, 50), // First 50 terms
    };
  }

  /**
   * Reinitialize the recommendation engine (useful after adding new recipes)
   * This is a wrapper around initializeCustomTfIdf for explicit reinitialization
   */
  async reinitialize(): Promise<{
    success: boolean;
    recipeCount: number;
    vocabularySize: number;
  }> {
    this.logger.log('🔄 Reinitializing Custom TF-IDF engine...');
    return await this.initializeCustomTfIdf();
  }
}
