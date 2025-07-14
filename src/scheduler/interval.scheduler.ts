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
