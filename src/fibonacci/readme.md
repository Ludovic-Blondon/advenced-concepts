# Worker

Certaine tache peuvent etre gourmande en CPU, dans ce cas on veut éviter de toutes les lancer en même temps pour éviter une surcharge.

C'est la qu'intervient le worker.

Il va s'occuper de résoudre une tache et si d'autre arrive en même temps il va les mettre en attente et les résoudre une par une.

Voici un exemple :

lancer (requete qui dvrait prendre environ 140 s a résoudre)
```shell
curl -X GET -w "\nTime total: %{time_total}s\n" "localhost:3000/fibonacci/?n=50"
```

et en parrallèle 
```shell
curl -X GET -w "\nTime total: %{time_total}s\n" "localhost:3000/fibonacci/?n=5"
```

La deuxième ne sera executé qu'une fois la prmiere terminé

Pendant ce temps l'API reste disponible, essayez de lancer ça pour le vérifier 
```shell
curl -X GET -w "\nTime total: %{time_total}s\n" "localhost:3000/"
```

Vous obtiendrez
```text
Hello World!
Time total: 0.001042s
```

Bingo l'API reste disponible et les tache gourmande sont géré avec un système de queue


Pour ce faire il faut implémenté le fibonacci-worker.host.ts
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

mettre la fonction qui résoud la suite de fibonacci dans fibonacci.worker.ts
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

et enfin l'implémenter dans le controller
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