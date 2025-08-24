import { Exclude } from 'class-transformer';
import { 
  Column, 
  Entity, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn, 
  OneToMany,
  ManyToMany,
  JoinTable
} from 'typeorm';
import { Recipe } from '../../recipes/entities/recipe.entity';
import { PantryItem } from '../../pantry/entities/pantry-item.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ nullable: true })
  name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column('simple-array', { nullable: true })
  dietaryPreferences: string[];

  @Column('simple-array', { nullable: true })
  allergies: string[];

  @OneToMany(() => Recipe, (recipe) => recipe.author)
  recipes: Recipe[];

  @OneToMany(() => PantryItem, (pantryItem) => pantryItem.user)
  pantryItems: PantryItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  @Exclude()
  currentHashedRefreshToken?: string;

  @ManyToMany(() => Recipe, (recipe) => recipe.likedBy, { onDelete: 'CASCADE' })
  @JoinTable()
  likedRecipes: Recipe[];

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
