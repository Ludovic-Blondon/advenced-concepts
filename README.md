<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Debugging Common Errors

Start dev server with debug mode 
```shell
NEST_DEBUG=true npm run start:dev
```

Show circular reference with madge 
```shell
npx madge dist/main.js --circular
```

Show it with graph
```shell
npx madge dist/main.js --image graph.png
```
Example :
![Graph circular reference example](graph.png)

## Lazy-loading Module

Lazy-loading module is for not importing modules everywhere in the project, example for cronjobs, microservices, etc ...

For generating a module without auto import 
```shell
nest g mo rewards --skip-import
```

This is an example of code for using lazy-loading with rewards module (make sure you have a grantTo method in rewards/rewards.service)
```ts
@Injectable()
export class CoffeesService {
  constructor(
    @Inject(COFFEES_DATA_SOURCE) dataSource: CoffeesDataSource,
    private readonly lazyModuleLoader: LazyModuleLoader,
  ) {}

  async create(createCoffeeDto: CreateCoffeeDto) {
    // Lazy load RewardsModule
    const rewardsModuleRef = await this.lazyModuleLoader.load(() =>
      import('../rewards/rewards.module').then((m) => m.RewardsModule),
    );
    const { RewardsService } = await import('../rewards/rewards.service');
    const rewardsService = rewardsModuleRef.get(RewardsService);
    rewardsService.grantTo();
    return 'This action adds a new coffee';
  }
  
  // ...
}
```

## Using `DiscoveryService` in NestJS (core)

This module allows you to dynamically explore **providers** and inspect the **metadata** associated with their classes or methods, using the tools provided by the NestJS core (`@nestjs/core`).

### 📚 Usage Example

#### 1. Create CRON service with custom decorators

Create decorators for the cron service instance
```ts
// src/scheduler/decorators/interval-host.decorator.ts
import { SetMetadata } from "@nestjs/common";

export const INTERVAL_HOST_KEY = 'INTERVAL_HOST_KEY';
export const IntervalHost: ClassDecorator = SetMetadata(INTERVAL_HOST_KEY, true);
```

```ts
// src/scheduler/decorators/interval.decorator.ts
import { SetMetadata } from "@nestjs/common";

export const INTERVAL_KEY = 'INTERVAL_KEY';
export const Interval = (ms: number) => SetMetadata(INTERVAL_KEY, ms);
```

Now create a cron service with methods wrapped with the interval decorator to run every second
```ts
// src/cron/cron.service.ts
import { IntervalHost } from 'src/scheduler/decorators/interval-host.decorator';
import { Interval } from 'src/scheduler/decorators/interval.decorator';

@IntervalHost
export class CronService {
    @Interval(1000)
    everySecond() {
        console.log('This will be logged every second 🐕');
    }
}
```

Finally, we need to check all providers with the INTERVAL_HOST_KEY and INTERVAL_KEY decorators to apply cron tasks.
For this, we use the DiscoveryService 
```ts
// src/scheduler/interval.scheduler.ts
import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { INTERVAL_HOST_KEY } from "./decorators/interval-host.decorator";
import { INTERVAL_KEY } from "./decorators/interval.decorator";

@Injectable()
export class IntervalScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
    constructor(
        private readonly discoveryService: DiscoveryService,
        private readonly reflector: Reflector,
        private readonly metadataScanner: MetadataScanner
    ) { }

    private readonly intervals: NodeJS.Timeout[] = [];

    onApplicationBootstrap() {
        const providers = this.discoveryService.getProviders();
        providers.forEach(wrapper => {
            const { instance } = wrapper;
            const prototype = instance && Object.getPrototypeOf(instance);

            if (!instance || !prototype) return;

            const intervalHost = this.reflector.get(INTERVAL_HOST_KEY, instance.constructor) ?? false;

            if (!intervalHost) return;

            const methodKeys = this.metadataScanner.getAllMethodNames(prototype);
            methodKeys.forEach(methodKey => {
                const interval = this.reflector.get(INTERVAL_KEY, instance[methodKey]);
                if (interval === undefined) return;

                const intervalRef = setInterval(instance[methodKey], interval);
                this.intervals.push(intervalRef);
            });
        });
    }

    onApplicationShutdown(_signal?: string) {
        this.intervals.forEach(interval => clearInterval(interval));
    }
}
```