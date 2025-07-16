import { Controller, Get, Post, Body, Patch, Param, Delete, Inject, UseInterceptors, RequestTimeoutException } from '@nestjs/common';
import { COFFEE_DATA_SOURCE, CoffeeDataSource, CoffeesService } from './coffees.service';
import { CreateCoffeeDto } from './dto/create-coffee.dto';
import { UpdateCoffeeDto } from './dto/update-coffee.dto';
import { CircuitBreakerInterceptor } from 'src/common/interceptors/circuit-breaker.interceptor';

@Controller('coffees')
@UseInterceptors(CircuitBreakerInterceptor)
export class CoffeesController {
  constructor(
    private readonly coffeesService: CoffeesService,
    @Inject(COFFEE_DATA_SOURCE)
    private readonly coffeeDataSource: CoffeeDataSource,
  ) { }

  @Post()
  create(@Body() createCoffeeDto: CreateCoffeeDto) {
    return this.coffeesService.create(createCoffeeDto);
  }

  @Get()
  findAll() {
    // Circuit breaker TEST !!! comment it for retrieve basic comportement
    console.log('🦊 findAll executed');
    throw new RequestTimeoutException('💥 Error!');
    return this.coffeesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coffeesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCoffeeDto: UpdateCoffeeDto) {
    return this.coffeesService.update(+id, updateCoffeeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coffeesService.remove(+id);
  }
}
