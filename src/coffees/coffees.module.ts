import { Module } from '@nestjs/common';
import { COFFEE_DATA_SOURCE, CoffeesService } from './coffees.service';
import { CoffeesController } from './coffees.controller';

@Module({
  controllers: [CoffeesController],
  providers: [
    CoffeesService,
    {
      provide: COFFEE_DATA_SOURCE,
      useValue: [],
    },
  ],
})
export class CoffeesModule {}
