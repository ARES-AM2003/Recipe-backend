import { ApiProperty } from '@nestjs/swagger';
import { Recipe } from '../../recipes/entities/recipe.entity';

export class RecommendationItemDto {
  @ApiProperty({
    description: 'The recommended recipe',
    type: Recipe,
  })
  recipe: Recipe;

  @ApiProperty({
    description: 'Recommendation score (0-1)',
    type: Number,
  })
  score: number;

  @ApiProperty({
    description: 'Type of recommendation',
    enum: ['content', 'collaborative', 'hybrid'],
  })
  type: 'content' | 'collaborative' | 'hybrid';

  @ApiProperty({
    description: 'Explanation of why this recipe was recommended',
    type: String,
  })
  reason: string;
}

export class RecommendationResponseDto {
  @ApiProperty({
    description: 'List of recommended recipes',
    type: [RecommendationItemDto],
  })
  recommendations: RecommendationItemDto[];

  @ApiProperty({
    description: 'Metadata about the recommendation process',
    type: Object,
  })
  metadata: {
    totalRecommendations: number;
    contentBasedCount: number;
    collaborativeCount: number;
    hybridCount: number;
    timestamp: Date;
  };
}
