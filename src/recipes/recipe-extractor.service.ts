import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ExtractedRecipeDataDto } from './dto/extract-recipe-from-url.dto';

@Injectable()
export class RecipeExtractorService {
  private readonly logger = new Logger(RecipeExtractorService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) {
      this.logger.error(
        '❌ OPENROUTER_API_KEY not configured! Recipe extraction from URLs will not work.',
      );
      this.logger.error('Please add OPENROUTER_API_KEY to your .env file');
    } else {
      this.logger.log('✅ OpenRouter API key found and configured');
      this.logger.log(
        `API Key: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 4)}`,
      );
    }

    // Initialize OpenAI client with OpenRouter base URL
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey || '',
      defaultHeaders: {
        'HTTP-Referer': 'https://recipe-recommendation-api.com',
        'X-Title': 'Recipe Extraction API',
      },
    });

    // Validate API key on startup
    if (apiKey) {
      this.validateApiKey(apiKey);
    }
  }

  /**
   * Validates the OpenRouter API key on startup
   */
  private async validateApiKey(apiKey: string): Promise<void> {
    try {
      this.logger.log('🔍 Validating OpenRouter API key...');

      const testCompletion = await this.openai.chat.completions.create({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [{ role: 'user', content: 'Say "OK"' }],
        max_tokens: 5,
      });

      if (testCompletion.choices?.[0]?.message?.content) {
        this.logger.log('✅ API key is valid and working!');
        this.logger.log(
          `Test response: ${testCompletion.choices[0].message.content}`,
        );
      }
    } catch (error: any) {
      this.logger.error('❌ API key validation failed!');
      this.logger.error(`Error: ${error.message}`);

      if (error.status === 401) {
        this.logger.error(
          'Invalid API key! Please check your OPENROUTER_API_KEY in .env file',
        );
      } else if (error.status === 402) {
        this.logger.error(
          'Insufficient credits! Your OpenRouter account may need credits.',
        );
      } else if (error.status === 429) {
        this.logger.error(
          'Rate limit reached! Please wait before making requests.',
        );
      } else {
        this.logger.error('Could not validate API key. Full error:', error);
      }
    }
  }

  /**
   * Fix common JSON issues from AI responses
   */
  private fixCommonJsonIssues(jsonString: string): string {
    let fixed = jsonString;

    // Remove trailing commas before closing braces/brackets
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // Fix unescaped quotes in string values
    fixed = fixed.replace(/: "([^"]*)"([^"]*?)"/g, (match, p1, p2) => {
      if (p2.includes('"')) {
        return `: "${p1}${p2.replace(/"/g, '\\"')}"`;
      }
      return match;
    });

    // Remove newlines within string values (common issue)
    fixed = fixed.replace(/: "([^"]*)\n([^"]*?)"/g, ': "$1 $2"');

    // Ensure proper comma placement between properties
    fixed = fixed.replace(/"\s*\n\s*"/g, '",\n"');

    // Fix incomplete JSON by attempting to close it
    const openBraces = (fixed.match(/{/g) || []).length;
    const closeBraces = (fixed.match(/}/g) || []).length;
    if (openBraces > closeBraces) {
      fixed += '}'.repeat(openBraces - closeBraces);
    }

    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      fixed += ']'.repeat(openBrackets - closeBrackets);
    }

    return fixed;
  }

  /**
   * Test if the OpenRouter API key is working
   */
  async testApiKey(): Promise<{
    success: boolean;
    message: string;
    model?: string;
    testResponse?: string;
  }> {
    try {
      this.logger.log('🔍 Testing OpenRouter API key...');

      const freeModels = [
        'google/gemini-2.0-flash-exp:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'google/gemini-flash-1.5',
        'mistralai/mistral-7b-instruct:free',
      ];

      for (const model of freeModels) {
        try {
          this.logger.log(`Testing model: ${model}`);
          const completion = await this.openai.chat.completions.create({
            model: model,
            messages: [{ role: 'user', content: 'Say "API key is working!"' }],
            max_tokens: 20,
            temperature: 0.1,
          });

          const response = completion.choices?.[0]?.message?.content;
          if (response) {
            this.logger.log(`✅ API key test successful with model: ${model}`);
            this.logger.log(`Response: ${response}`);
            return {
              success: true,
              message: 'OpenRouter API key is valid and working!',
              model: model,
              testResponse: response,
            };
          }
        } catch (error: any) {
          this.logger.warn(
            `Model ${model} failed: ${error.error?.message || error.message}`,
          );
          continue;
        }
      }

      throw new Error('All models failed. API key may be invalid.');
    } catch (error: any) {
      this.logger.error(`❌ API key test failed: ${error.message}`);
      return {
        success: false,
        message: `API key test failed: ${error.message}`,
      };
    }
  }

  /**
   * Detects if URL is a video platform
   */
  private isVideoUrl(url: string): boolean {
    const videoPatterns = [
      /youtube\.com\/watch/i,
      /youtu\.be\//i,
      /vimeo\.com/i,
      /tiktok\.com/i,
      /instagram\.com\/(p|reel)\//i,
      /facebook\.com\/watch/i,
      /dailymotion\.com/i,
    ];

    return videoPatterns.some((pattern) => pattern.test(url));
  }

  /**
   * Extracts video ID and metadata for recipe extraction
   */
  private async extractVideoMetadata(url: string): Promise<string> {
    try {
      // For YouTube videos, we can extract from the page metadata
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      const $ = cheerio.load(response.data);

      // Extract title and description
      const title =
        $('title').text() ||
        $('meta[property="og:title"]').attr('content') ||
        '';
      const description =
        $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') ||
        '';

      // Try to get video transcript or description
      let content = `Video Title: ${title}\n\nDescription: ${description}\n\n`;

      // Look for recipe information in the page
      const recipeInfo = $('.recipe, #recipe, [itemtype*="Recipe"]').text();
      if (recipeInfo) {
        content += `Recipe Information: ${recipeInfo}\n\n`;
      }

      // Get any structured data
      $('script[type="application/ld+json"]').each((_, element) => {
        try {
          const jsonData = JSON.parse($(element).html() || '{}');
          if (
            jsonData['@type'] === 'Recipe' ||
            jsonData['@type']?.includes('Recipe')
          ) {
            content += `Structured Recipe Data: ${JSON.stringify(jsonData, null, 2)}\n\n`;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      });

      return content;
    } catch (error) {
      this.logger.warn(`Failed to extract video metadata: ${error.message}`);
      throw new BadRequestException(
        'Unable to extract recipe from video URL. Please provide a text-based recipe URL or the recipe details manually.',
      );
    }
  }

  /**
   * Validates if the URL likely contains a recipe
   */
  private async validateRecipeUrl(
    url: string,
    content: string,
  ): Promise<boolean> {
    const recipeKeywords = [
      'recipe',
      'ingredient',
      'instruction',
      'cook',
      'bake',
      'preparation',
      'serving',
      'cuisine',
      'meal',
      'dish',
      'food',
      'kitchen',
      'chef',
      'tablespoon',
      'teaspoon',
      'cup',
      'ounce',
      'gram',
      'calories',
    ];

    const lowerContent = content.toLowerCase();
    const keywordMatches = recipeKeywords.filter((keyword) =>
      lowerContent.includes(keyword),
    ).length;

    // If less than 3 recipe-related keywords, likely not a recipe
    return keywordMatches >= 3;
  }

  /**
   * Fetches webpage content and extracts text with retry mechanism
   */
  private async fetchWebpageContent(url: string): Promise<string> {
    // Try multiple strategies to fetch content
    const strategies = [
      this.fetchWithEnhancedHeaders.bind(this),
      this.fetchWithSimpleHeaders.bind(this),
      this.fetchWithMobileHeaders.bind(this),
    ];

    let lastError: Error | null = null;

    for (let i = 0; i < strategies.length; i++) {
      try {
        this.logger.log(
          `Fetching content (attempt ${i + 1}/${strategies.length})...`,
        );
        const response = await strategies[i](url);
        return await this.extractRecipeContent(response.data, url);
      } catch (error) {
        lastError = error;
        this.logger.warn(`Attempt ${i + 1} failed: ${error.message}`);
        if (i < strategies.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
    }

    // If all strategies failed, throw the last error
    throw lastError;
  }

  /**
   * Fetch with enhanced browser-like headers
   */
  private async fetchWithEnhancedHeaders(url: string) {
    return axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'sec-ch-ua':
          '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        DNT: '1',
        Referer: 'https://www.google.com/',
      },
      validateStatus: (status) => status >= 200 && status < 400,
      decompress: true,
    });
  }

  /**
   * Fetch with simple headers
   */
  private async fetchWithSimpleHeaders(url: string) {
    return axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });
  }

  /**
   * Fetch with mobile user agent (some sites are less strict with mobile)
   */
  private async fetchWithMobileHeaders(url: string) {
    return axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });
  }

  /**
   * Extract recipe content from HTML response
   */
  private async extractRecipeContent(
    html: string,
    url: string,
  ): Promise<string> {
    try {
      const $ = cheerio.load(html);

      // First, try to extract structured recipe data (schema.org)
      let structuredData = '';
      $('script[type="application/ld+json"]').each((_, element) => {
        try {
          const jsonData = JSON.parse($(element).html() || '{}');
          if (
            jsonData['@type'] === 'Recipe' ||
            (Array.isArray(jsonData['@graph']) &&
              jsonData['@graph'].some(
                (item: any) => item['@type'] === 'Recipe',
              ))
          ) {
            structuredData = JSON.stringify(jsonData, null, 2);
            return false; // Break the loop
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      });

      if (structuredData) {
        this.logger.log('Found structured recipe data (schema.org)');
        return `STRUCTURED RECIPE DATA:\n${structuredData}`;
      }

      // Remove script, style, and other non-content elements
      $(
        'script, style, nav, header, footer, iframe, noscript, aside, .advertisement, .ads, .social-share, .comments',
      ).remove();

      // Try to find recipe-specific content
      let content = '';

      // Common recipe content selectors (in order of specificity)
      const recipeSelectors = [
        '[itemtype*="Recipe"]',
        '[typeof="Recipe"]',
        '.recipe-content',
        '.recipe-container',
        '.recipe-body',
        '#recipe-content',
        '#recipe',
        '.recipe',
        '.wprm-recipe',
        '.tasty-recipes',
        '.easyrecipe',
        '.mv-create-card',
        '.zlrecipe-recipe',
        '.post-content .recipe',
        'article[class*="recipe"]',
        'div[class*="recipe"]',
        'article',
        'main',
        '.post-content',
        '.entry-content',
        '.article-content',
      ];

      for (const selector of recipeSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text();
          if (content.trim().length > 200) {
            this.logger.log(`Found recipe content using selector: ${selector}`);
            break;
          }
        }
      }

      // Fallback to body if no specific recipe content found
      if (!content || content.trim().length < 200) {
        content = $('body').text();
        this.logger.log('Using full body content as fallback');
      }

      // Clean up whitespace
      content = content.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();

      // Limit content length to avoid token limits
      if (content.length > 20000) {
        content = content.substring(0, 20000);
        this.logger.log('Content truncated to 20,000 characters');
      }

      // Validate if content likely contains a recipe
      const isRecipe = await this.validateRecipeUrl(url, content);
      if (!isRecipe) {
        throw new BadRequestException(
          'The provided URL does not appear to contain a recipe. Please ensure the URL points to a recipe page with ingredients and instructions.',
        );
      }

      return content;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to extract content: ${error.message}`);

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new BadRequestException(
          'Request timeout: The webpage took too long to respond. Please try again or use a different URL.',
        );
      }

      if (error.code === 'ENOTFOUND') {
        throw new BadRequestException(
          'URL not found: Please check if the URL is correct and accessible.',
        );
      }

      if (error.response?.status === 403) {
        throw new BadRequestException(
          'Access forbidden: The website is blocking automated requests. Try a different recipe source or manually enter the recipe.',
        );
      }

      throw new BadRequestException(
        `Failed to fetch webpage content: ${error.message}. The website may be blocking automated access. Try a different URL.`,
      );
    }
  }

  /**
   * Extracts recipe data using OpenRouter AI
   */
  async extractRecipeFromUrl(
    url?: string,
    additionalInstructions?: string,
    rawHtml?: string,
  ): Promise<ExtractedRecipeDataDto> {
    this.logger.log('========================================');
    this.logger.log('🚀 Starting Recipe Extraction Process');
    this.logger.log('========================================');

    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) {
      this.logger.error('❌ OPENROUTER_API_KEY is not configured!');
      throw new BadRequestException(
        'OPENROUTER_API_KEY is not configured. Please add it to your .env file.',
      );
    }

    this.logger.log(
      `✅ API Key found: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 4)}`,
    );

    if (!url && !rawHtml) {
      this.logger.error('❌ Neither url nor rawHtml provided');
      throw new BadRequestException('Either url or rawHtml must be provided.');
    }

    this.logger.log(
      `📝 Extracting recipe from ${rawHtml ? 'raw HTML (manual input)' : `URL: ${url}`}`,
    );

    if (additionalInstructions) {
      this.logger.log(`💡 Additional instructions: ${additionalInstructions}`);
    }

    let webpageContent: string;
    let isVideo = false;

    if (rawHtml) {
      // Use provided raw HTML
      this.logger.log('📄 Processing provided raw HTML content...');
      this.logger.log(`HTML length: ${rawHtml.length} characters`);
      webpageContent = await this.extractRecipeContent(
        rawHtml,
        url || 'manual',
      );
    } else if (url) {
      // Detect content type
      isVideo = this.isVideoUrl(url);

      if (isVideo) {
        this.logger.log('🎥 Detected video URL, extracting metadata...');
        webpageContent = await this.extractVideoMetadata(url);
      } else {
        // Fetch regular webpage content
        this.logger.log('🌐 Fetching webpage content...');
        webpageContent = await this.fetchWebpageContent(url);
      }
    } else {
      throw new BadRequestException('Either url or rawHtml must be provided.');
    }

    this.logger.log(
      `📊 Extracted content length: ${webpageContent.length} characters`,
    );

    // Create enhanced AI prompt for better extraction
    const systemPrompt = `You are an expert recipe extraction AI. Your task is to extract complete and accurate recipe information from the provided content and return it as valid JSON.

CRITICAL RULES:
1. You MUST respond with ONLY valid, complete JSON - no markdown, no code blocks, no explanations, no trailing text
2. Ensure the JSON is properly closed with all brackets and braces
3. Do NOT truncate the response - complete the full JSON structure
4. Extract ALL available information accurately
5. If a field is not found, use reasonable defaults or omit optional fields
6. Ensure all measurements are converted to standard units
7. Validate that the content actually contains a recipe before extracting
8. ALL string values must use proper JSON escaping for quotes and special characters

REQUIRED JSON STRUCTURE (Use these EXACT values for enums):
{
  "title": "Recipe name (REQUIRED)",
  "description": "Brief description of the dish",
  "difficulty": "EASY" | "MEDIUM" | "HARD",
  "prepTime": <number in minutes>,
  "cookTime": <number in minutes>,
  "servings": <number of servings>,
  "cuisine": "ITALIAN" | "MEXICAN" | "CHINESE" | "INDIAN" | "AMERICAN" | "FRENCH" | "JAPANESE" | "THAI" | "MEDITERRANEAN" | "OTHER",
  "mealType": "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | "DESSERT" | "APPETIZER" | "BEVERAGE",
  "instructions": ["Step 1", "Step 2", "Step 3"],
  "tags": ["keyword1", "keyword2"],
  "imageUrl": "URL of recipe image if available",
  "ingredients": [
    {
      "name": "ingredient name (lowercase, singular, just the ingredient)",
      "amount": <numeric value (must be a number, convert fractions)>,
      "unit": "g" | "ml" | "cup" | "tbsp" | "tsp" | "piece" | "oz" | "lb" | "kg" | "l",
      "notes": "preparation notes like 'diced', 'chopped', 'minced'"
    }
  ],
  "calories": <number per serving>,
  "protein": <grams per serving>,
  "carbs": <grams per serving>,
  "fat": <grams per serving>,
  "fiber": <grams per serving>,
  "sugar": <grams per serving>,
  "sodium": <grams per serving>
}

EXTRACTION GUIDELINES:
- Convert all time values to minutes (e.g., "1 hour" = 60)
- Ingredient names: ONLY the ingredient name, lowercase (e.g., "chicken breast" not "boneless chicken breast cut into pieces")
- Convert measurements to numeric values (e.g., "1/2" = 0.5, "1 1/2" = 1.5, "2-3" = 2.5)
- Use standard units: g, ml, cup, tbsp, tsp, piece, oz, lb, kg, l
- Put preparation details in "notes" field (e.g., name: "chicken", notes: "boneless, cut into pieces")
- For difficulty: EASY (< 30 min total), MEDIUM (30-60 min), HARD (> 60 min)
- Match cuisine to closest category from the list above, use OTHER if no match (e.g., Nepalese = OTHER, Korean = OTHER)
- Extract nutrition info if available, otherwise estimate based on ingredients
- **INSTRUCTIONS FORMATTING:**
  * Each instruction should be ONE clear, complete sentence or step
  * Number steps sequentially (1, 2, 3...) OR use clear action words (Preheat, Mix, Cook...)
  * Remove bullet points, numbering, and extra formatting
  * Keep steps concise but complete (one action per step)
  * Combine very short related steps into one coherent instruction
  * Example GOOD: "Preheat oven to 350°F and grease a 9-inch pan"
  * Example BAD: "1. Preheat\n2. Grease pan" or "- preheat oven - grease pan"
- Include relevant tags (diet type, cooking method, main ingredient, etc.)
- IMPORTANT: Use ONLY the exact enum values specified above (e.g., "EASY" not "easy", "ITALIAN" not "italian")

VALIDATION:
- Ensure title and at least 2 ingredients are present
- Verify ingredient amounts are positive numbers
- Check that instructions make sense for cooking
- Confirm the content is actually a recipe (not a blog post, product page, etc.)`;

    const userPrompt = `Extract the recipe from the following ${isVideo ? 'video page' : 'webpage'} content.
${additionalInstructions ? `\nADDITIONAL INSTRUCTIONS: ${additionalInstructions}\n` : ''}
${isVideo ? '\nNote: This is from a video page. Extract recipe information from the title, description, and any available recipe details.\n' : ''}
Content:

${webpageContent}

Return ONLY the JSON object, with no markdown formatting or additional text.`;

    try {
      this.logger.log('========================================');
      this.logger.log('🤖 Calling OpenRouter AI for extraction');
      this.logger.log('========================================');

      // Try models in order of preference (very cheap paid models after free tier exhausted)
      const models = [
        'google/gemini-2.0-flash-exp:free', // Free but rate limited
        'meta-llama/llama-3.2-3b-instruct:free', // Free but rate limited
        'google/gemini-flash-1.5-8b', // Very cheap: ~$0.0001 per request
        'google/gemini-flash-1.5', // Very cheap: ~$0.0002 per request
        'meta-llama/llama-3.1-8b-instruct', // Cheap: ~$0.0003 per request
      ];

      this.logger.log(`📋 Available models to try: ${models.length}`);
      models.forEach((model, index) => {
        this.logger.log(`  ${index + 1}. ${model}`);
      });

      let completion;
      let lastError;
      let usedModel = '';

      for (let i = 0; i < models.length; i++) {
        const model = models[i];
        try {
          this.logger.log(
            `\n🔄 Attempt ${i + 1}/${models.length}: Trying model: ${model}`,
          );
          this.logger.log(`⏱️  Sending request to OpenRouter...`);

          const startTime = Date.now();

          completion = await this.openai.chat.completions.create({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 4000, // Increased to prevent JSON truncation
            top_p: 0.9,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
          });

          const duration = Date.now() - startTime;
          usedModel = model;

          this.logger.log(`✅ Successfully used model: ${model}`);
          this.logger.log(`⏱️  Response time: ${duration}ms`);
          this.logger.log(
            `📊 Tokens used: ${completion.usage?.total_tokens || 'N/A'}`,
          );
          break; // Success, exit loop
        } catch (error: any) {
          lastError = error;
          this.logger.error(`❌ Model ${model} failed!`);
          this.logger.error(`Error: ${error.error?.message || error.message}`);

          if (error.status) {
            this.logger.error(`HTTP Status: ${error.status}`);

            // Provide helpful guidance for rate limits
            if (error.status === 429) {
              if (error.error?.message?.includes('free-models-per-day')) {
                this.logger.warn(
                  `💡 Free tier daily limit reached for this model`,
                );
                this.logger.warn(
                  `💰 Trying paid models next (very cheap: ~$0.0001-0.0003 per request)`,
                );
                this.logger.warn(
                  `📊 To get 1000 free requests/day, add $10 credits at https://openrouter.ai/credits`,
                );
              }
            }
          }

          if (i < models.length - 1) {
            this.logger.log(`⏭️  Trying next model...`);
          }
        }
      }

      if (!completion) {
        this.logger.error('❌ All models failed!');
        throw lastError || new Error('All models failed');
      }

      const extractedContent = completion.choices?.[0]?.message?.content;
      if (!extractedContent) {
        this.logger.error('❌ No content received from AI');
        throw new Error('No content received from AI');
      }

      this.logger.log('🔍 Parsing AI response...');
      this.logger.log('\n========================================');
      this.logger.log('✅ AI Extraction Successful!');
      this.logger.log('========================================');
      this.logger.log(`🤖 Model used: ${usedModel}`);
      this.logger.log(
        `📝 Response length: ${extractedContent.length} characters`,
      );
      this.logger.log('🔍 Parsing JSON response...');

      // Log full response for debugging
      this.logger.log('📄 Full AI Response:');
      this.logger.log('-'.repeat(80));
      this.logger.log(extractedContent);
      this.logger.log('-'.repeat(80));

      // Parse and validate JSON
      let extractedData: any;
      try {
        // Remove markdown code blocks if present
        let cleanContent = extractedContent.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent
            .replace(/```json\n?/g, '')
            .replace(/```\n?$/g, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent
            .replace(/```\n?/g, '')
            .replace(/```\n?$/g, '');
        }

        // Try to fix common JSON issues
        cleanContent = this.fixCommonJsonIssues(cleanContent);

        extractedData = JSON.parse(cleanContent);
        this.logger.log('✅ Successfully parsed JSON response');
      } catch (parseError) {
        this.logger.error(
          `❌ Failed to parse AI response: ${parseError.message}`,
        );
        this.logger.error(`📄 Full response that failed to parse:`);
        this.logger.error(extractedContent);
        this.logger.error('-'.repeat(80));

        // Try to extract JSON from response if it's embedded in text
        const jsonMatch = extractedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          this.logger.log('🔄 Attempting to extract JSON from response...');
          try {
            const fixedJson = this.fixCommonJsonIssues(jsonMatch[0]);
            extractedData = JSON.parse(fixedJson);
            this.logger.log('✅ Successfully extracted and parsed JSON!');
          } catch (retryError) {
            this.logger.error(`❌ Retry also failed: ${retryError.message}`);
            throw new BadRequestException(
              'Failed to parse recipe data from AI response. The AI may have returned invalid JSON.',
            );
          }
        } else {
          throw new BadRequestException(
            'Failed to parse recipe data from AI response. The AI may have returned invalid JSON.',
          );
        }
      }

      // Add source URL
      extractedData.sourceUrl = url;

      // Validate required fields
      if (
        !extractedData.title ||
        !extractedData.ingredients ||
        !Array.isArray(extractedData.ingredients) ||
        extractedData.ingredients.length === 0
      ) {
        throw new BadRequestException(
          'Extracted recipe is missing required fields (title or ingredients). The URL may not contain a valid recipe.',
        );
      }

      // Ensure instructions is an array and clean up formatting
      if (
        !extractedData.instructions ||
        !Array.isArray(extractedData.instructions)
      ) {
        extractedData.instructions = [];
      } else {
        // Clean up instruction formatting
        extractedData.instructions = extractedData.instructions
          .map((instruction: string) => {
            if (!instruction || typeof instruction !== 'string') return '';

            // Remove common formatting issues
            let cleaned = instruction
              .trim()
              // Remove leading numbers and dots (1. 2. etc)
              .replace(/^\d+\.\s*/, '')
              // Remove leading bullets (-, *, •)
              .replace(/^[-*•]\s*/, '')
              // Remove multiple spaces
              .replace(/\s+/g, ' ')
              // Remove trailing periods if multiple
              .replace(/\.+$/, '.')
              // Ensure proper sentence ending
              .trim();

            // Ensure first letter is capitalized
            if (cleaned.length > 0) {
              cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
            }

            // Add period if missing and not ending with other punctuation
            if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
              cleaned += '.';
            }

            return cleaned;
          })
          .filter((instruction: string) => instruction.length > 0); // Remove empty instructions
      }

      // Validate and clean ingredients
      extractedData.ingredients = extractedData.ingredients
        .filter((ing: any) => ing.name && ing.amount > 0)
        .map((ing: any) => ({
          name: ing.name.toLowerCase().trim(),
          amount: parseFloat(ing.amount),
          unit: ing.unit || 'piece',
          notes: ing.notes || undefined,
        }));

      if (extractedData.ingredients.length === 0) {
        throw new BadRequestException(
          'No valid ingredients found in the extracted recipe.',
        );
      }

      this.logger.log('='.repeat(80));
      this.logger.log('✅ RECIPE EXTRACTION SUCCESSFUL!');
      this.logger.log('='.repeat(80));
      this.logger.log(`📝 Title: ${extractedData.title}`);
      this.logger.log(`🥘 Ingredients: ${extractedData.ingredients.length}`);
      this.logger.log(
        `📋 Instructions: ${extractedData.instructions?.length || 0} steps`,
      );

      // Log first 3 instructions as samples
      if (extractedData.instructions && extractedData.instructions.length > 0) {
        this.logger.log(`📝 Sample instructions:`);
        extractedData.instructions
          .slice(0, 3)
          .forEach((inst: string, idx: number) => {
            this.logger.log(
              `   ${idx + 1}. ${inst.substring(0, 100)}${inst.length > 100 ? '...' : ''}`,
            );
          });
      }
      this.logger.log(`⏱️  Prep Time: ${extractedData.prepTime || 0} min`);
      this.logger.log(`🔥 Cook Time: ${extractedData.cookTime || 0} min`);
      this.logger.log(`🍽️  Servings: ${extractedData.servings || 0}`);
      this.logger.log(`🌍 Cuisine: ${extractedData.cuisine || 'N/A'}`);
      this.logger.log(`🍴 Meal Type: ${extractedData.mealType || 'N/A'}`);
      this.logger.log('='.repeat(80));

      return extractedData as ExtractedRecipeDataDto;
    } catch (error: any) {
      this.logger.error('='.repeat(80));
      this.logger.error('❌ RECIPE EXTRACTION FAILED!');
      this.logger.error('='.repeat(80));
      this.logger.error(`Error: ${error.message}`);

      // Handle OpenAI SDK errors
      if (error.status) {
        this.logger.error(`❌ API Error Status: ${error.status}`);
        this.logger.error(`❌ API Error Message: ${error.message}`);

        if (error.status === 401) {
          this.logger.error('❌ INVALID API KEY!');
          throw new BadRequestException(
            'Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY in the .env file.',
          );
        }

        if (error.status === 429) {
          this.logger.error('❌ RATE LIMIT EXCEEDED!');
          this.logger.error(
            '💡 SOLUTION: Add $10 credits at https://openrouter.ai/credits',
          );
          this.logger.error('📊 This unlocks 1000 free model requests per day');
          this.logger.error(
            '💰 Or the system will use cheap paid models (~$0.0001 per request)',
          );
          throw new BadRequestException(
            'Rate limit exceeded. Free tier exhausted. Add $10 credits at https://openrouter.ai/credits to unlock 1000 free requests/day, or the system will automatically use very cheap paid models (~$0.0001 per request).',
          );
        }

        if (error.status === 404) {
          this.logger.error('❌ ALL MODELS FAILED!');
          this.logger.error(
            '💡 SOLUTION: Wait a few minutes and try again, or add credits',
          );
          this.logger.error(
            '📊 Add $10 at https://openrouter.ai/credits for 1000 free requests/day',
          );
          throw new BadRequestException(
            'All AI models failed. This usually means free tier limits are exhausted. Solutions: 1) Wait a few minutes and retry, 2) Add $10 credits at https://openrouter.ai/credits to unlock 1000 free requests/day, 3) Use the raw HTML method instead.',
          );
        }

        if (error.status === 402) {
          this.logger.error('❌ INSUFFICIENT CREDITS!');
          throw new BadRequestException(
            'Insufficient credits. The free model quota may be exhausted. Please try again later or use a different API key.',
          );
        }
      }

      this.logger.error('='.repeat(80));

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        `Failed to extract recipe using AI: ${error.message}`,
      );
    }
  }

  /**
   * Extracts recipe from raw HTML (helper method for when URLs are blocked)
   */
  async extractRecipeFromRawHtml(
    html: string,
    additionalInstructions?: string,
  ): Promise<ExtractedRecipeDataDto> {
    return this.extractRecipeFromUrl(undefined, additionalInstructions, html);
  }

  /**
   * Validates if a URL is accessible
   */
  async validateUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 10000,
        maxRedirects: 5,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      return response.status >= 200 && response.status < 400;
    } catch (error) {
      this.logger.warn(`URL validation failed for ${url}: ${error.message}`);
      return false;
    }
  }
}
