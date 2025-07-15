# Worker

Certaines tâches peuvent être gourmandes en CPU. Dans ce cas, on veut éviter de toutes les lancer en même temps pour éviter une surcharge.

C'est là qu'intervient le worker.

Il va s'occuper de résoudre une tâche et si d'autres arrivent en même temps, il va les mettre en attente et les résoudre une par une.

Voici un exemple :

Lancer (requête qui devrait prendre environ 140 s à résoudre) :
```shell
curl -X GET -w "\nTime total: %{time_total}s\n" "localhost:3000/fibonacci/?n=50"
```

Et en parallèle :
```shell
curl -X GET -w "\nTime total: %{time_total}s\n" "localhost:3000/fibonacci/?n=5"
```

La deuxième ne sera exécutée qu'une fois la première terminée.

Pendant ce temps, l'API reste disponible. Essayez de lancer ceci pour le vérifier :
```shell
curl -X GET -w "\nTime total: %{time_total}s\n" "localhost:3000/"
```

Vous obtiendrez :
```text
Hello World!
Time total: 0.001042s
```

Bingo ! L'API reste disponible et les tâches gourmandes sont gérées avec un système de queue.

## Implémentation

Pour ce faire, il faut implémenter le `fibonacci-worker.host.ts` :

```ts
import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { randomUUID } from "crypto";
import { join } from "path";
import { filter, firstValueFrom, fromEvent, map, Observable } from "rxjs";
import { Worker } from "worker_threads";

@Injectable()
export class FibonacciWorkerHost
    implements OnApplicationBootstrap, OnApplicationShutdown {
    private worker: Worker;
    private message: Observable<{ result: number, id: string }>;

    onApplicationBootstrap() {
        console.log('FibonacciWorkerHost onApplicationBootstrap');
        this.worker = new Worker(join(__dirname, 'fibonacci.worker.js'));
        this.message = fromEvent(this.worker, 'message') as Observable<{ result: number, id: string }>;
    }

    async onApplicationShutdown() {
        console.log('FibonacciWorkerHost onApplicationShutdown');
        this.worker.terminate();
    }

    run(n: number) {
        const uniqueId = randomUUID();
        this.worker.postMessage({ n, id: uniqueId });
        return firstValueFrom(
            this.message.pipe(
                filter(({ id }) => id === uniqueId),
                map(({ result }) => result)
            )
        );
    }
}
```

Mettre la fonction qui résout la suite de Fibonacci dans `fibonacci.worker.ts` :

```ts
import { parentPort } from "worker_threads";

function fib(n: number): number {
    if (n < 2) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}

parentPort?.on('message', ({ n, id }) => {
    const result = fib(n);
    parentPort?.postMessage({ result, id });
});
```

Et enfin l'implémenter dans le controller :

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { FibonacciWorkerHost } from './fibonacci-worker.host';

@Controller('fibonacci')
export class FibonacciController {
    constructor(private readonly fibonacciWorkerHost: FibonacciWorkerHost) { }
    @Get()
    getFibonacci(@Query('n') n = 10) {
        return this.fibonacciWorkerHost.run(n);
    }
}
```

Et le tour est joué !!! 🎉

## Version simplifiée avec Piscina

Ce qui précède est la version bas niveau avec `worker_threads`, mais il existe un package pour faire beaucoup plus simple.

### Installation de Piscina

```shell
npm i piscina
```

### Configuration TypeScript

Ajouter cette ligne dans le `tsconfig.json` :

```json
{
  "compilerOptions": {
    ...
    "esModuleInterop": true,
    ...
  }
}
```

### Implémentation avec Piscina

Voici le code à mettre dans le controller. Par défaut, Piscina met 4 threads en parallèle. Pour ce test, on va le régler à 1 :

```ts
import { Controller, Get, Query } from '@nestjs/common';
import Piscina from 'piscina';
import { resolve } from 'path';

@Controller('fibonacci')
export class FibonacciController {
    private fibonacciWorker = new Piscina({
        filename: resolve(__dirname, 'fibonacci.worker.js'),
        maxThreads: 1,
    });

    @Get()
    getFibonacci(@Query('n') n = 10) {
        return this.fibonacciWorker.run(n);
    }
}
```

Et adapter le code du worker :

```ts
function fib(n: number): number {
    if (n < 2) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}

export default fib;
```

Et voilà 🎉, nous avons le même résultat !

Cette fois-ci, le fichier `fibonacci-worker.host.ts` peut être supprimé. Piscina fait le travail pour nous. 😘