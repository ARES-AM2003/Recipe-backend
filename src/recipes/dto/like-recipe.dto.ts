import { ApiProperty } from '@nestjs/swagger';

export class LikeRecipeResponseDto {
  @ApiProperty({ description: 'The recipe that was liked/unliked' })
  recipe: {
    id: string;
    title: string;
    description: string;
    author: {
      id: string;
      name: string;
      email: string;
    };
    likedBy: {
      id: string;
      name: string;
      email: string;
    }[];
  };

  @ApiProperty({
    description: 'Whether the recipe is now liked by the user',
    example: true
  })
  isLiked: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Recipe liked successfully'
  })
  message: string;
}

export class RecipeLikeInfoDto {
  @ApiProperty({
    description: 'Number of users who liked this recipe',
    example: 15
  })
  likeCount: number;

  @ApiProperty({
    description: 'List of users who liked this recipe',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' }
      }
    }
  })
  likedBy: {
    id: string;
    name: string;
    email: string;
  }[];
}

export class UserLikeStatusDto {
  @ApiProperty({
    description: 'Whether the user has liked this recipe',
    example: true
  })
  isLiked: boolean;
}

export class LikedRecipesResponseDto {
  @ApiProperty({
    description: 'List of liked recipes',
    type: 'array'
  })
  data: any[];

  @ApiProperty({
    description: 'Total number of liked recipes',
    example: 25
  })
  count: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3
  })
  totalPages: number;
}
