/**
 * Script to convert bulk recipe data from simplified format to the correct format
 *
 * Input format (from Excel/CSV):
 * - instructions: semicolon-separated string
 * - tags: comma-separated string
 * - ingredients: comma-separated string of ingredient names
 *
 * Output format (for API):
 * - instructions: array of strings
 * - tags: array of strings
 * - ingredients: array of objects with {ingredientId, amount, unit}
 */

const fs = require('fs');
const path = require('path');

/**
 * Convert simplified bulk recipe format to API-compatible format
 * @param {Array} recipes - Array of recipes in simplified format
 * @param {Object} ingredientMap - Map of ingredient names to IDs (optional)
 * @returns {Object} - Formatted data ready for bulk API
 */
function convertBulkRecipes(recipes, ingredientMap = {}) {
  const convertedRecipes = recipes.map((recipe, index) => {
    try {
      // Convert instructions from semicolon-separated string to array
      const instructions = typeof recipe.instructions === 'string'
        ? recipe.instructions.split(';').map(s => s.trim()).filter(Boolean)
        : Array.isArray(recipe.instructions)
        ? recipe.instructions
        : [];

      // Convert tags from comma-separated string to array
      const tags = typeof recipe.tags === 'string'
        ? recipe.tags.split(',').map(s => s.trim()).filter(Boolean)
        : Array.isArray(recipe.tags)
        ? recipe.tags
        : [];

      // Convert ingredients
      let ingredients = [];
      if (typeof recipe.ingredients === 'string') {
        // Split by comma and create ingredient objects
        const ingredientNames = recipe.ingredients.split(',').map(s => s.trim()).filter(Boolean);

        ingredients = ingredientNames.map((name, idx) => {
          // Look up ingredient ID from map, or use a placeholder
          const ingredientId = ingredientMap[name.toLowerCase()] || `ingredient-${name.toLowerCase().replace(/\s+/g, '-')}`;

          return {
            ingredientId: ingredientId,
            amount: 100, // Default amount - you should update this
            unit: 'g', // Default unit - you should update this
            notes: name
          };
        });
      } else if (Array.isArray(recipe.ingredients)) {
        ingredients = recipe.ingredients;
      }

      // Return converted recipe
      return {
        title: recipe.title,
        description: recipe.description,
        difficulty: recipe.difficulty,
        instructions: instructions,
        prepTime: Number(recipe.prepTime),
        cookTime: Number(recipe.cookTime),
        servings: Number(recipe.servings),
        cuisine: recipe.cuisine,
        mealType: recipe.mealType,
        tags: tags,
        imageUrl: recipe.imageUrl || undefined,
        ingredients: ingredients,
        calories: Number(recipe.calories),
        protein: Number(recipe.protein),
        carbs: Number(recipe.carbs),
        fat: Number(recipe.fat),
        fiber: Number(recipe.fiber),
        sugar: Number(recipe.sugar),
        sodium: Number(recipe.sodium)
      };
    } catch (error) {
      console.error(`Error converting recipe at index ${index}:`, error.message);
      return null;
    }
  }).filter(Boolean); // Remove any null entries from failed conversions

  return {
    recipes: convertedRecipes
  };
}

/**
 * Main function - reads input file and writes output file
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node convert-bulk-recipes.js <input-file> [output-file] [ingredient-map-file]');
    console.log('');
    console.log('Example:');
    console.log('  node convert-bulk-recipes.js input.json output.json');
    console.log('  node convert-bulk-recipes.js input.json output.json ingredient-map.json');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || 'converted-recipes.json';
  const ingredientMapFile = args[2];

  // Read input file
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file "${inputFile}" not found`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(inputFile, 'utf8');
  let inputData;

  try {
    inputData = JSON.parse(rawData);
  } catch (error) {
    console.error('Error parsing input JSON:', error.message);
    process.exit(1);
  }

  // Read ingredient map if provided
  let ingredientMap = {};
  if (ingredientMapFile && fs.existsSync(ingredientMapFile)) {
    try {
      const mapData = fs.readFileSync(ingredientMapFile, 'utf8');
      ingredientMap = JSON.parse(mapData);
      console.log(`Loaded ${Object.keys(ingredientMap).length} ingredients from map`);
    } catch (error) {
      console.warn('Warning: Could not load ingredient map:', error.message);
    }
  }

  // Handle both array input and object with recipes property
  const recipes = Array.isArray(inputData) ? inputData : inputData.recipes || [];

  if (recipes.length === 0) {
    console.error('Error: No recipes found in input file');
    process.exit(1);
  }

  console.log(`Converting ${recipes.length} recipes...`);

  // Convert recipes
  const converted = convertBulkRecipes(recipes, ingredientMap);

  // Write output file
  fs.writeFileSync(outputFile, JSON.stringify(converted, null, 2), 'utf8');

  console.log(`✅ Successfully converted ${converted.recipes.length} recipes`);
  console.log(`📄 Output saved to: ${outputFile}`);
  console.log('');
  console.log('⚠️  IMPORTANT: Please review the ingredient IDs and update them with actual IDs from your database!');
  console.log('⚠️  Also update the amount and unit values for each ingredient.');
}

// Export for use as module
if (require.main === module) {
  main();
} else {
  module.exports = { convertBulkRecipes };
}
