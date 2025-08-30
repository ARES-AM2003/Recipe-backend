import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipe } from '../recipes/entities/recipe.entity';
import { User } from '../users/entities/user.entity';
import { PantryItem } from '../pantry/entities/pantry-item.entity';
import * as fs from 'fs';
import * as path from 'path';

interface RecommendationFilters {
  difficulty?: string;
  cuisine?: string;
  mealType?: string;
  maxPrepTime?: number;
  minRating?: number;
  tags?: string[];
}

@Injectable()
export class RecommendationVecService implements OnModuleInit {
  private embeddings: Record<string, number[]> = {};
  private embeddingsLoaded = false;

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Recipe) private recipesRepo: Repository<Recipe>,
    @InjectRepository(PantryItem) private pantryRepo: Repository<PantryItem>,
  ) {}

  async onModuleInit() {
    await this.initializeEmbeddings();
  }

  private async initializeEmbeddings() {
    if (this.embeddingsLoaded) return;

    const embeddingPath = path.resolve(
      '/home/ares-am/Projects/windsurf/recipie/recipe-recommendation-api/src/ingredients/ingredents-embeddings/ingredient_embeddings.json',
    );

    if (!fs.existsSync(embeddingPath)) {
      throw new Error('Embedding file not found at ' + embeddingPath);
    }

    this.embeddings = JSON.parse(fs.readFileSync(embeddingPath, 'utf-8'));
    this.embeddingsLoaded = true;
    console.log(
      '✅ Loaded embeddings for',
      Object.keys(this.embeddings).length,
      'ingredients',
    );
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    if (magA === 0 || magB === 0) return 0;
    return dot / (magA * magB);
  }

  private normalizeIngredient(word: string) {
    return word.toLowerCase().replace(/\s+/g, '_');
  }

  private getVector(word: string): number[] | null {
    const key = this.normalizeIngredient(word);
    const vec = this.embeddings[key];
    if (!vec) console.warn(`⚠️ Ingredient embedding not found: ${word}`);
    // console.log(this.embeddings);
    console.log(vec);
    return vec || null;
  }

  async getRecommendations(
    userId: string,
    filters: RecommendationFilters = {},
  ): Promise<Recipe[]> {
    await this.initializeEmbeddings();
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['pantryItems', 'pantryItems.ingredient'],
    });
    if (!user) throw new Error('User not found');

    const userAllergies = (user.allergies || []).map((a) =>
      a
        .replace(/[\[\]']+/g, '')
        .trim()
        .toLowerCase(),
    );

    console.log('🧾 Cleaned User allergies:', userAllergies);

    const pantryIngredients =
      user.pantryItems?.map((pi) => pi.ingredient.name.toLowerCase()) || [];

    console.log('🧾 User allergies:', userAllergies);
    console.log('🥫 User pantry:', pantryIngredients);

    const allRecipes = await this.recipesRepo.find({
      relations: ['ingredients'],
    });

    // Filter out unsafe recipes
    const safeRecipes = allRecipes.filter(
      (r) =>
        !r.ingredients.some((ing) =>
          userAllergies.some((allergy) =>
            ing.name.toLowerCase().includes(allergy),
          ),
        ),
    );
    console.log('✅ Safe recipes count:', safeRecipes.length);

    // Map pantry ingredients to vectors
    const pantryVectors = pantryIngredients
      .map((i) => this.getVector(i))
      .filter((v): v is number[] => v !== null);

    if (!pantryVectors.length) {
      console.warn(
        '⚠️ No pantry ingredient embeddings found. Recommendations will be based only on filters.',
      );
    }

    // Score recipes
    const scoredRecipes = safeRecipes.map((recipe) => {
      const recipeVectors = recipe.ingredients
        .map((i) => this.getVector(i.name))
        .filter((v): v is number[] => v !== null);

      if (!recipeVectors.length || !pantryVectors.length)
        return { recipe, score: 0 };

      const score =
        recipeVectors.reduce((sum, rVec) => {
          const maxSim = pantryVectors.reduce(
            (max, pVec) => Math.max(max, this.cosineSimilarity(pVec, rVec)),
            0,
          );
          return sum + maxSim;
        }, 0) / recipeVectors.length;

      return { recipe, score };
    });
    console.log(scoredRecipes);

    // Apply filters and log
    const filteredRecipes = scoredRecipes
      .filter(({ recipe }) => {
        let passed = true;

        if (filters.difficulty) {
          if (recipe.difficulty !== filters.difficulty) {
            console.log(`[Filter] ${recipe.title} ❌ difficulty`);
            passed = false;
          } else {
            console.log(`[Filter] ${recipe.title} ✅ difficulty`);
          }
        }

        if (filters.cuisine) {
          if (recipe.cuisine !== filters.cuisine) {
            console.log(`[Filter] ${recipe.title} ❌ cuisine`);
            passed = false;
          } else {
            console.log(`[Filter] ${recipe.title} ✅ cuisine`);
          }
        }

        if (filters.mealType) {
          if (recipe.mealType !== filters.mealType) {
            console.log(`[Filter] ${recipe.title} ❌ mealType`);
            passed = false;
          } else {
            console.log(`[Filter] ${recipe.title} ✅ mealType`);
          }
        }

        if (filters.maxPrepTime) {
          if (recipe.prepTime > filters.maxPrepTime) {
            console.log(`[Filter] ${recipe.title} ❌ maxPrepTime`);
            passed = false;
          } else {
            console.log(`[Filter] ${recipe.title} ✅ maxPrepTime`);
          }
        }

        if (filters.minRating) {
          if (recipe.averageRating < filters.minRating) {
            console.log(`[Filter] ${recipe.title} ❌ minRating`);
            passed = false;
          } else {
            console.log(`[Filter] ${recipe.title} ✅ minRating`);
          }
        }

        if (filters.tags && filters.tags.length > 0) {
          if (!recipe.tags?.some((t) => filters.tags?.includes(t))) {
            console.log(`[Filter] ${recipe.title} ❌ tags`);
            passed = false;
          } else {
            console.log(`[Filter] ${recipe.title} ✅ tags`);
          }
        }

        return passed;
      })
      .sort((a, b) => {
        const diff = b.score - a.score;
        if (diff !== 0) return diff;
        return b.recipe.averageRating - a.recipe.averageRating;
      });

    return filteredRecipes.map((r) => r.recipe);
  }
}
