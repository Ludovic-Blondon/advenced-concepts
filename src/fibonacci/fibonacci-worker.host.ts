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