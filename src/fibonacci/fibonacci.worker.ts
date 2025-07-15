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