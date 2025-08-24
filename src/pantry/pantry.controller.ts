import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  Patch,
} from '@nestjs/common';
import { PantryService } from './pantry.service';
import { AddPantryItemDto } from './dto/add-pantry-item.dto';
import { UpdatePantryItemDto } from './dto/update-pantry-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('pantry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pantry')
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @Post('items')
  @ApiOperation({ summary: 'Add an item to the pantry' })
  addItem(
    @GetUser() user: User,
    @Body() addPantryItemDto: AddPantryItemDto,
  ) {
    return this.pantryService.addItem(user, addPantryItemDto);
  }

  @Get('items')
  @ApiOperation({ summary: 'Get all items in the pantry' })
  findAll(
    @GetUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
    @Query('ingredients') ingredientIds?: string,
    @Query('categories') categories?: string,
    @Query('favorite') favorite?: string,
    @Query('expiringSoon') expiringSoon?: string,
  ) {
    const filter: any = {};
    
    if (ingredientIds) {
      filter.ingredientIds = ingredientIds.split(',');
    }
    
    if (categories) {
      filter.categories = categories.split(',');
    }
    
    if (favorite !== undefined) {
      filter.isFavorite = favorite === 'true';
    }
    
    if (expiringSoon === 'true') {
      filter.expiringSoon = true;
    }

    return this.pantryService.findAll(user.id, page, limit, filter);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get a specific pantry item' })
  findOne(@GetUser() user: User, @Param('id') id: string) {
    return this.pantryService.findOne(user.id, id);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update a pantry item' })
  update(
    @GetUser() user: User,
    @Param('id') id: string,
    @Body() updatePantryItemDto: UpdatePantryItemDto,
  ) {
    return this.pantryService.update(user.id, id, updatePantryItemDto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Remove an item from the pantry' })
  remove(@GetUser() user: User, @Param('id') id: string) {
    return this.pantryService.remove(user.id, id);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get pantry summary' })
  getSummary(@GetUser() user: User) {
    return this.pantryService.getPantrySummary(user.id);
  }
}
