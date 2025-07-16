import { CallHandler } from "@nestjs/common";
import { tap, throwError } from "rxjs";

const SUCCESS_THRESHOLD = 3; // the number of successful operations above which we close the circuit
const FAILURE_THRESHOLD = 3; // the number of failures above which we open the circuit
const OPEN_TO_HALF_OPEN_WAIT_TIME = 60000; // 1 minute in milliseconds

enum CircuitState {
    CLOSED = 'closed',
    OPEN = 'open',
    HALF_OPEN = 'half-open',
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private successCount: number = 0;
    private lastError: Error;
    private nextAttempt: number;

    exec(next: CallHandler) {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() < this.nextAttempt) {
                return throwError(() => this.lastError);
            }
            this.state = CircuitState.HALF_OPEN;
        }

        return next.handle().pipe(
            tap({
                next: () => this.handleSuccess(),
                error: (error) => this.handleFailure(error),
            }),
        );
    }

    private handleSuccess() {
        this.failureCount = 0;
        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= SUCCESS_THRESHOLD) {
                this.successCount = 0;
                this.state = CircuitState.CLOSED;
            }
        }
    }

    private handleFailure(error: Error) {
        this.failureCount++;
        if (
            this.failureCount >= FAILURE_THRESHOLD ||
            this.state === CircuitState.HALF_OPEN
        ) {
            this.state = CircuitState.OPEN;
            this.lastError = error;
            this.nextAttempt = Date.now() + OPEN_TO_HALF_OPEN_WAIT_TIME;
        }
    }
}