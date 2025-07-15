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
