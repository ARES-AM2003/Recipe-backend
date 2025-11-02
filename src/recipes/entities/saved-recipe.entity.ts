import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Column,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Recipe } from './recipe.entity';

@Entity('saved_recipes')
@Unique('UQ_saved_recipe_user_recipe', ['userId', 'recipeId']) // Prevent duplicate saves
export class SavedRecipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.savedRecipes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipeId' })
  recipe: Recipe;

  @Column()
  recipeId: string;

  @CreateDateColumn()
  savedAt: Date;

  constructor(partial: Partial<SavedRecipe>) {
    Object.assign(this, partial);
  }
}
