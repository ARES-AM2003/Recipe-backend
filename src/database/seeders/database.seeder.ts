import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../users/entities/user.entity';
import {
  Ingredient,
  IngredientCategory,
} from '../../ingredients/entities/ingredient.entity';
import {
  Recipe,
  CuisineType,
  MealType,
} from '../../recipes/entities/recipe.entity';
import {
  PantryItem,
  QuantityUnit,
} from '../../pantry/entities/pantry-item.entity';

@Injectable()
export class DatabaseSeeder implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(PantryItem)
    private readonly pantryItemRepository: Repository<PantryItem>,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') {
      await this.seed();
    }
  }

  // async seed() {
  //   // Clear existing data
  //   await this.clearDatabase();

  //   // Seed users
  //   const users = await this.seedUsers();

  //   // Seed ingredients
  //   const ingredients = await this.seedIngredients();

  //   // Seed recipes
  //   const recipes = await this.seedRecipes(users[0], ingredients);

  //   // Seed pantry items
  //   await this.seedPantryItems(users[0], ingredients);

  //   console.log('Database seeded successfully!');

  //   return {
  //     users,
  //     ingredients,
  //     recipes,
  //   };
  // }
  async seed() {
    console.log('Seeding database...');
    // await this.clearDatabase();
    // const users = await this.seedUsers();
    // const ingredients = await this.seedIngredients();
    // const recipes = await this.seedRecipes(users[0], ingredients);
    // await this.seedPantryItems(users[0], ingredients);
    console.log('Database seeded successfuly!');
  }
  private async clearDatabase() {
    // Use query builder to safely clear all tables
    await this.pantryItemRepository.createQueryBuilder().delete().execute();
    await this.recipeRepository.createQueryBuilder().delete().execute();
    await this.ingredientRepository.createQueryBuilder().delete().execute();
    await this.userRepository.createQueryBuilder().delete().execute();
  }

  private async seedUsers(): Promise<User[]> {
    const userData = [
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: await bcrypt.hash('password123', 10),
        role: UserRole.ADMIN,
        dietaryPreferences: ['vegetarian'],
        allergies: ['peanuts'],
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: await bcrypt.hash('password123', 10),
        role: UserRole.USER,
        dietaryPreferences: ['vegan', 'gluten-free'],
        allergies: ['dairy', 'eggs'],
      },
      {
        name: 'John Doe',
        email: 'john@example.com',
        password: await bcrypt.hash('password123', 10),
        role: UserRole.USER,
        dietaryPreferences: ['keto'],
        allergies: ['shellfish'],
      },
    ];

    // Create and save users one by one to ensure proper typing
    const users: User[] = [];
    for (const data of userData) {
      // Hash the password before saving
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create user using repository's create method for proper type safety
      const user = this.userRepository.create({
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role as UserRole,
        dietaryPreferences: data.dietaryPreferences || [],
        allergies: data.allergies || [],
      });

      users.push(await this.userRepository.save(user));
    }
    return users;
  }

  private async seedIngredients(): Promise<Ingredient[]> {
    const ingredientData = [
      // Proteins
      {
        name: 'Chicken Breast',
        description: 'Boneless, skinless chicken breast',
        category: IngredientCategory.MEAT,
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        fiber: 0,
        sugar: 0,
        sodium: 74,
        isCommon: true,
      },
      {
        name: 'Salmon Fillet',
        description: 'Fresh Atlantic salmon fillet',
        category: IngredientCategory.SEAFOOD,
        calories: 208,
        protein: 20,
        carbs: 0,
        fat: 13,
        fiber: 0,
        sugar: 0,
        sodium: 59,
        isCommon: true,
      },
      {
        name: 'Black Beans',
        description: 'Canned black beans, drained and rinsed',
        category: IngredientCategory.LEGUME,
        calories: 114,
        protein: 8,
        carbs: 21,
        fat: 0.5,
        fiber: 7.5,
        sugar: 0.3,
        sodium: 1,
        isCommon: true,
      },
      // Vegetables
      {
        name: 'Broccoli',
        description: 'Fresh broccoli florets',
        category: IngredientCategory.VEGETABLE,
        calories: 55,
        protein: 3.7,
        carbs: 11.2,
        fat: 0.6,
        fiber: 5.1,
        sugar: 2.2,
        sodium: 33,
        isCommon: true,
      },
      {
        name: 'Spinach',
        description: 'Fresh baby spinach leaves',
        category: IngredientCategory.VEGETABLE,
        calories: 23,
        protein: 2.9,
        carbs: 3.6,
        fat: 0.4,
        fiber: 2.2,
        sugar: 0.4,
        sodium: 79,
        isCommon: true,
      },
      // Grains
      {
        name: 'Brown Rice',
        description: 'Long grain brown rice',
        category: IngredientCategory.GRAIN,
        calories: 111,
        protein: 2.6,
        carbs: 23,
        fat: 0.9,
        fiber: 1.8,
        sugar: 0.4,
        sodium: 5,
        isCommon: true,
      },
      // Dairy
      {
        name: 'Cheddar Cheese',
        description: 'Sharp cheddar cheese, shredded',
        category: IngredientCategory.DAIRY,
        calories: 402,
        protein: 25,
        carbs: 1.3,
        fat: 33,
        fiber: 0,
        sugar: 0.5,
        sodium: 621,
        isCommon: true,
      },
      // Herbs & Spices
      {
        name: 'Garlic Powder',
        description: 'Dried, ground garlic',
        category: IngredientCategory.SPICE,
        calories: 10,
        protein: 0.5,
        carbs: 2.2,
        fat: 0,
        fiber: 0.3,
        sugar: 0.1,
        sodium: 1,
        isCommon: true,
      },
      // Oils
      {
        name: 'Olive Oil',
        description: 'Extra virgin olive oil',
        category: IngredientCategory.OIL,
        calories: 884,
        protein: 0,
        carbs: 0,
        fat: 100,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        isCommon: true,
      },
      // Sweeteners
      {
        name: 'Honey',
        description: 'Raw, unfiltered honey',
        category: IngredientCategory.SWEETENER,
        calories: 304,
        protein: 0.3,
        carbs: 82.4,
        fat: 0,
        fiber: 0.2,
        sugar: 82.1,
        sodium: 4,
        isCommon: true,
      },
      // Condiments
      {
        name: 'Soy Sauce',
        description: 'Regular soy sauce',
        category: IngredientCategory.CONDIMENT,
        calories: 53,
        protein: 8.5,
        carbs: 5.6,
        fat: 0.1,
        fiber: 0.8,
        sugar: 0.6,
        sodium: 6,
        isCommon: true,
      },
    ];

    // Create ingredient instances first
    const ingredients = ingredientData.map((ingredient) =>
      this.ingredientRepository.create(ingredient),
    );

    // Then save them to get proper entity instances with IDs
    return this.ingredientRepository.save(ingredients);
  }

  private async seedRecipes(
    user: User,
    ingredients: Ingredient[],
  ): Promise<Recipe[]> {
    const recipeData = [
      {
        title: 'Grilled Chicken Salad',
        description: 'A healthy and delicious grilled chicken salad',
        instructions: [
          'Season chicken with salt, pepper, and olive oil',
          'Grill chicken for 6-7 minutes per side',
          'Let rest for 5 minutes, then slice',
          'Toss mixed greens with olive oil and lemon juice',
          'Top with sliced chicken and serve',
        ],
        prepTime: 10,
        cookTime: 15,
        servings: 2,
        cuisine: CuisineType.MEDITERRANEAN,
        mealType: MealType.LUNCH,
        tags: ['healthy', 'high-protein', 'low-carb'],
        imageUrl: 'https://example.com/chicken-salad.jpg',
        calories: 350,
        protein: 35,
        carbs: 12,
        fat: 18,
        fiber: 5,
        sugar: 4,
        sodium: 450,
        author: user,
        ingredients: [
          { ingredient: ingredients[0], amount: 200, unit: QuantityUnit.GRAMS },
          { ingredient: ingredients[3], amount: 100, unit: QuantityUnit.GRAMS },
          { ingredient: ingredients[4], amount: 50, unit: QuantityUnit.GRAMS },
          {
            ingredient: ingredients[9],
            amount: 1,
            unit: QuantityUnit.TABLESPOONS,
          },
        ],
      },
      {
        title: 'Vegan Buddha Bowl',
        description: 'A nutritious and colorful plant-based bowl',
        instructions: [
          'Cook brown rice according to package instructions',
          'Roast sweet potatoes and chickpeas with olive oil and spices',
          'Prepare avocado and assemble bowl with all ingredients',
          'Drizzle with tahini dressing',
        ],
        prepTime: 15,
        cookTime: 30,
        servings: 2,
        cuisine: CuisineType.OTHER,
        mealType: MealType.DINNER,
        tags: ['vegan', 'gluten-free', 'high-fiber'],
        imageUrl: 'https://example.com/buddha-bowl.jpg',
        calories: 420,
        protein: 15,
        carbs: 58,
        fat: 16,
        fiber: 14,
        sugar: 8,
        sodium: 320,
        author: user,
        ingredients: [
          { ingredient: ingredients[2], amount: 100, unit: QuantityUnit.GRAMS },
          { ingredient: ingredients[5], amount: 150, unit: QuantityUnit.GRAMS },
          {
            ingredient: ingredients[8],
            amount: 0.5,
            unit: QuantityUnit.PIECES,
          },
          { ingredient: ingredients[3], amount: 50, unit: QuantityUnit.GRAMS },
        ],
      },
    ];

    // Create recipe instances with proper typing
    const recipes: Recipe[] = [];

    for (const data of recipeData) {
      const { ingredients, ...recipeData } = data;
      const recipe = this.recipeRepository.create({
        title: recipeData.title,
        description: recipeData.description,
        instructions: recipeData.instructions,
        prepTime: recipeData.prepTime,
        cookTime: recipeData.cookTime,
        servings: recipeData.servings,
        cuisine: recipeData.cuisine,
        mealType: recipeData.mealType,
        tags: recipeData.tags,
        imageUrl: recipeData.imageUrl,
        calories: recipeData.calories,
        protein: recipeData.protein,
        carbs: recipeData.carbs,
        fat: recipeData.fat,
        fiber: recipeData.fiber,
        sugar: recipeData.sugar,
        author: user,
      });

      const savedRecipe = await this.recipeRepository.save(recipe);

      // Create and save recipe ingredients using the relation
      if (ingredients && ingredients.length > 0) {
        // First, ensure all ingredients exist
        const ingredientIds = ingredients.map((ing) => ing.ingredient.id);
        const existingIngredients =
          await this.ingredientRepository.findByIds(ingredientIds);

        // Create a map of ingredient IDs to their entities for quick lookup
        const ingredientMap = new Map(
          existingIngredients.map((ing) => [ing.id, ing]),
        );

        // Set the ingredients relation
        savedRecipe.ingredients = ingredients
          .map((ing) => ingredientMap.get(ing.ingredient.id))
          .filter((ing): ing is Ingredient => ing !== undefined);

        // Save the updated recipe with ingredients
        await this.recipeRepository.save(savedRecipe);
      }

      // Reload the recipe with relations
      const fullRecipe = await this.recipeRepository.findOne({
        where: { id: savedRecipe.id },
        relations: ['ingredients', 'author'],
      });

      if (fullRecipe) {
        recipes.push(fullRecipe);
      }
    }

    return recipes;
  }

  private async seedPantryItems(
    user: User,
    ingredients: Ingredient[],
  ): Promise<PantryItem[]> {
    const pantryItemData = [
      {
        user,
        ingredient: ingredients[0], // Chicken
        quantity: 2,
        unit: QuantityUnit.KILOGRAMS,
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        isFavorite: true,
      },
      {
        user,
        ingredient: ingredients[3], // Broccoli
        quantity: 500,
        unit: QuantityUnit.GRAMS,
        expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        isFavorite: false,
      },
      {
        user,
        ingredient: ingredients[5], // Brown Rice
        quantity: 1,
        unit: QuantityUnit.KILOGRAMS,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        isFavorite: true,
      },
    ];

    // Create pantry item instances with proper typing
    const pantryItems = pantryItemData.map((data) =>
      this.pantryItemRepository.create(data),
    );

    return this.pantryItemRepository.save(pantryItems);
  }
}
