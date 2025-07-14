import { Injectable } from '@nestjs/common';

@Injectable()
export class RewardsService {
    grantTo() {
        console.log('Hello from yhe lazy-loaded RewardsService 👋')
    }
}
