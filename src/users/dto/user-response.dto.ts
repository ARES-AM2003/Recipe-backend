// user-response.dto.ts
export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  role: string;
  dietaryPreferences: string[];
  allergies: string[];
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
