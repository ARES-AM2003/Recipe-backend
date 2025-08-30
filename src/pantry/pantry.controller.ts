import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  // UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  Patch,
  Req,
} from '@nestjs/common';
import { PantryService } from './pantry.service';
import { AddPantryItemDto } from './dto/add-pantry-item.dto';
import { UpdatePantryItemDto } from './dto/update-pantry-item.dto';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Auth } from 'src/auth/decorators/auth.decorator';

@ApiTags('pantry')
@ApiBearerAuth('JWT')
@Auth()
@Controller('pantry')
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @ApiBearerAuth('JWT')
  @Auth()
  @Post('items')
  @ApiOperation({ summary: 'Add an item to the pantry' })
  async addItem(@Req() req: any, @Body() addPantryItemDto: AddPantryItemDto) {
    const user = req.user as User;
    return await this.pantryService.addItem(user, addPantryItemDto);
  }

  @ApiBearerAuth('JWT')
  @Auth()
  @Get('items')
  @ApiOperation({ summary: 'Get all items in the pantry' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page (default 10)',
  })
  @ApiQuery({
    name: 'ingredients',
    required: false,
    type: String,
    description: 'Comma-separated ingredient IDs',
  })
  @ApiQuery({
    name: 'categories',
    required: false,
    type: String,
    description: 'Comma-separated category names or IDs',
  })
  @ApiQuery({
    name: 'favorite',
    required: false,
    type: Boolean,
    description: 'Filter favorite items',
  })
  @ApiQuery({
    name: 'expiringSoon',
    required: false,
    type: Boolean,
    description: 'Filter items that are expiring soon',
  })
  async findAll(
    @Req() req: any,
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

    return await this.pantryService.findAll(req.user.id, page, limit, filter);
  }

  @Get('items/:id')
  @ApiBearerAuth('JWT')
  @Auth()
  @ApiOperation({ summary: 'Get a specific pantry item' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    return await this.pantryService.findOne(req.user.id, id);
  }

  @Patch('items/:id')
  @ApiBearerAuth('JWT')
  @Auth()
  @ApiOperation({ summary: 'Update a pantry item' })
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updatePantryItemDto: UpdatePantryItemDto,
  ) {
    console.log('Updating pantry item:', updatePantryItemDto);
    return await this.pantryService.update(
      req.user.id,
      id,
      updatePantryItemDto,
    );
  }

  @Delete('items/:id')
  @ApiBearerAuth('JWT')
  @Auth()
  @ApiOperation({ summary: 'Remove an item from the pantry' })
  async remove(@Req() req: any, @Param('id') id: string) {
    return await this.pantryService.remove(req.user.id, id);
  }

  @Get('summary')
  @ApiBearerAuth('JWT')
  @Auth()
  @ApiOperation({ summary: 'Get pantry summary' })
  async getSummary(@Req() req: any) {
    return await this.pantryService.getPantrySummary(req.user.id);
  }
}
