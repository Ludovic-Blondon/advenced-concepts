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
