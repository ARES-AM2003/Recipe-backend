import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { BulkRecipeDto } from '../dto/bulk-upload-recipe.dto';
import {
  CuisineType,
  DifficultyLevel,
  MealType,
} from '../entities/recipe.entity';

@Injectable()
export class ExcelParserService {
  private readonly EXPECTED_HEADERS = [
    'title',
    'description',
    'difficulty',
    'instructions',
    'prepTime',
    'cookTime',
    'servings',
    'cuisine',
    'mealType',
    'tags',
    'imageUrl',
    'calories',
    'protein',
    'carbs',
    'fat',
    'fiber',
    'sugar',
    'sodium',
    'ingredients',
  ];

  parseExcelFile(buffer: Buffer): BulkRecipeDto[] {
    try {
      // Read the Excel file from buffer
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      // Get the first worksheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new BadRequestException(
          'Excel file must contain at least one worksheet',
        );
      }

      const worksheet = workbook.Sheets[sheetName];

      // Convert worksheet to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new BadRequestException(
          'Excel file must contain headers and at least one data row',
        );
      }

      // Get headers (first row)
      const headers = jsonData[0] as string[];
      this.validateHeaders(headers);

      // Process data rows
      const recipes: BulkRecipeDto[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as unknown[];
        if (this.isEmptyRow(row)) {
          continue; // Skip empty rows
        }

        try {
          const recipe = this.parseRowToRecipe(headers, row, i + 1);
          recipes.push(recipe);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new BadRequestException(
            `Error in row ${i + 1}: ${errorMessage}`,
          );
        }
      }

      if (recipes.length === 0) {
        throw new BadRequestException(
          'No valid recipe data found in Excel file',
        );
      }

      return recipes;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new BadRequestException(
        `Failed to parse Excel file: ${errorMessage}`,
      );
    }
  }

  private validateHeaders(headers: string[]): void {
    const normalizedHeaders = headers.map((h) =>
      h?.toString().toLowerCase().trim(),
    );
    const missingHeaders = this.EXPECTED_HEADERS.filter(
      (expected) => !normalizedHeaders.includes(expected.toLowerCase()),
    );

    if (missingHeaders.length > 0) {
      throw new BadRequestException(
        `Missing required headers: ${missingHeaders.join(', ')}. ` +
          `Expected headers: ${this.EXPECTED_HEADERS.join(', ')}`,
      );
    }
  }

  private parseRowToRecipe(
    headers: string[],
    row: unknown[],
    rowNumber: number,
  ): BulkRecipeDto {
    const recipe: Record<string, unknown> = {};

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]?.toString().toLowerCase().trim();
      const value = row[i];

      switch (header) {
        case 'title':
          recipe.title = this.parseStringValue(value, 'title');
          break;
        case 'description':
          recipe.description = this.parseStringValue(value, 'description');
          break;
        case 'difficulty':
          recipe.difficulty = this.parseDifficultyValue(value);
          break;
        case 'instructions':
          recipe.instructions = this.parseStringValue(value, 'instructions');
          break;
        case 'preptime':
          recipe.prepTime = this.parseNumberValue(value, 'prepTime');
          break;
        case 'cooktime':
          recipe.cookTime = this.parseNumberValue(value, 'cookTime');
          break;
        case 'servings':
          recipe.servings = this.parseNumberValue(value, 'servings');
          break;
        case 'cuisine':
          recipe.cuisine = this.parseCuisineValue(value);
          break;
        case 'mealtype':
          recipe.mealType = this.parseMealTypeValue(value);
          break;
        case 'tags':
          recipe.tags = this.parseOptionalStringValue(value);
          break;
        case 'imageurl':
          recipe.imageUrl = this.parseOptionalStringValue(value);
          break;
        case 'calories':
          recipe.calories = this.parseNumberValue(value, 'calories', 0);
          break;
        case 'protein':
          recipe.protein = this.parseNumberValue(value, 'protein', 0);
          break;
        case 'carbs':
          recipe.carbs = this.parseNumberValue(value, 'carbs', 0);
          break;
        case 'fat':
          recipe.fat = this.parseNumberValue(value, 'fat', 0);
          break;
        case 'fiber':
          recipe.fiber = this.parseNumberValue(value, 'fiber', 0);
          break;
        case 'sugar':
          recipe.sugar = this.parseNumberValue(value, 'sugar', 0);
          break;
        case 'sodium':
          recipe.sodium = this.parseNumberValue(value, 'sodium', 0);
          break;
        case 'ingredients':
          recipe.ingredients = this.parseStringValue(value, 'ingredients');
          break;
      }
    }

    return recipe as unknown as BulkRecipeDto;
  }

  private parseStringValue(value: unknown, fieldName: string): string {
    if (value === null || value === undefined || value === '') {
      throw new Error(`${fieldName} is required but was empty`);
    }
    return String(value).trim();
  }

  private parseOptionalStringValue(value: unknown): string | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return String(value).trim();
  }

  private parseNumberValue(
    value: unknown,
    fieldName: string,
    defaultValue?: number,
  ): number {
    if (value === null || value === undefined || value === '') {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`${fieldName} is required but was empty`);
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      throw new Error(`${fieldName} must be a valid number, got: ${value}`);
    }

    if (numValue < 0) {
      throw new Error(
        `${fieldName} must be a non-negative number, got: ${numValue}`,
      );
    }

    return numValue;
  }

  private parseDifficultyValue(value: unknown): DifficultyLevel {
    if (value === null || value === undefined || value === '') {
      throw new Error('difficulty is required but was empty');
    }

    const difficulty = String(value).trim();
    const validDifficulties = Object.values(DifficultyLevel);
    const matchedDifficulty = validDifficulties.find(
      (d) => d.toLowerCase() === difficulty.toLowerCase(),
    );

    if (!matchedDifficulty) {
      throw new Error(
        `Invalid difficulty level: ${difficulty}. Valid options: ${validDifficulties.join(', ')}`,
      );
    }

    return matchedDifficulty;
  }

  private parseCuisineValue(value: unknown): CuisineType {
    if (value === null || value === undefined || value === '') {
      return CuisineType.OTHER; // Default value
    }

    const cuisine = String(value).trim();
    const validCuisines = Object.values(CuisineType);
    const matchedCuisine = validCuisines.find(
      (c) => c.toLowerCase() === cuisine.toLowerCase(),
    );

    if (!matchedCuisine) {
      throw new Error(
        `Invalid cuisine type: ${cuisine}. Valid options: ${validCuisines.join(', ')}`,
      );
    }

    return matchedCuisine;
  }

  private parseMealTypeValue(value: unknown): MealType {
    if (value === null || value === undefined || value === '') {
      return MealType.DINNER; // Default value
    }

    const mealType = String(value).trim();
    const validMealTypes = Object.values(MealType);
    const matchedMealType = validMealTypes.find(
      (m) => m.toLowerCase() === mealType.toLowerCase(),
    );

    if (!matchedMealType) {
      throw new Error(
        `Invalid meal type: ${mealType}. Valid options: ${validMealTypes.join(', ')}`,
      );
    }

    return matchedMealType;
  }

  private isEmptyRow(row: unknown[]): boolean {
    return row.every(
      (cell) => cell === null || cell === undefined || cell === '',
    );
  }

  generateExcelTemplate(): Buffer {
    // Create sample data for the template
    const templateData = [
      this.EXPECTED_HEADERS,
      [
        'Spaghetti Carbonara',
        'Classic Italian pasta dish with eggs, cheese, and pancetta',
        'Medium',
        'Boil pasta in salted water; Cook pancetta until crispy; Beat eggs with cheese; Combine hot pasta with pancetta; Add egg mixture off heat; Toss until creamy',
        10,
        15,
        4,
        'Italian',
        'Dinner',
        'pasta,italian,creamy',
        'https://example.com/carbonara.jpg',
        450,
        18,
        55,
        22,
        3,
        2,
        1.2,
        'spaghetti,eggs,parmesan cheese,pancetta,black pepper',
      ],
      [
        'Chicken Tikka Masala',
        'Creamy tomato curry with marinated chicken pieces',
        'Medium',
        'Marinate chicken in yogurt and spices; Grill chicken until cooked; Make tomato-cream sauce; Simmer chicken in sauce; Serve with rice',
        30,
        25,
        6,
        'Indian',
        'Dinner',
        'curry,indian,spicy,chicken',
        '',
        380,
        32,
        12,
        24,
        2,
        8,
        1.8,
        'chicken breast,yogurt,tomatoes,cream,onion,garlic,ginger,garam masala',
      ],
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(templateData);

    // Set column widths for better readability
    const columnWidths = [
      { wch: 20 }, // title
      { wch: 40 }, // description
      { wch: 10 }, // difficulty
      { wch: 50 }, // instructions
      { wch: 10 }, // prepTime
      { wch: 10 }, // cookTime
      { wch: 10 }, // servings
      { wch: 15 }, // cuisine
      { wch: 12 }, // mealType
      { wch: 20 }, // tags
      { wch: 30 }, // imageUrl
      { wch: 10 }, // calories
      { wch: 10 }, // protein
      { wch: 10 }, // carbs
      { wch: 10 }, // fat
      { wch: 10 }, // fiber
      { wch: 10 }, // sugar
      { wch: 10 }, // sodium
      { wch: 40 }, // ingredients
    ];

    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Recipes');

    // Generate buffer
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}
