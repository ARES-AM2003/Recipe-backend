import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { User } from './entities/user.entity';
import { GetUser } from '../common/decorators/get-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/auth/decorators/auth.decorator';

export interface RequestWithUser extends Request {
  user: User;
}

@Auth()
@ApiTags('users')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  
  @Get('me')
 async getProfile(@Req() request: any) {
  console.log(request.user);
    return await this.usersService.findById(request.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.usersService.findById(id);
  }

  @Patch('me')
  async update(@Req() req:any, @Body() updateUserDto: UpdateUserDto) {
    return await this.usersService.update(req.user.id, updateUserDto);
  }

  @Delete('me')
  async remove(@Req() request: any) {
    // In a real app, you might want to implement soft delete
    await this.usersService.remove(request.user.id);
    request.res?.clearCookie('Authentication');
    request.res?.clearCookie('Refresh');
    return { message: 'User account deleted successfully' };
  }

  @Patch('preferences')
  async updatePreferences(
    @Req() req:any,
    @Body()
    preferences: { dietaryPreferences?: string[]; allergies?: string[] },
  ) {
    return this.usersService.update(req.user.id, {
      dietaryPreferences: preferences.dietaryPreferences,
      allergies: preferences.allergies,
    });
  }
}
