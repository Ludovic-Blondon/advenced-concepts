# Circuit Breaker Pattern 🔌

Le **Circuit Breaker** bloque temporairement les appels vers un service défaillant après plusieurs erreurs, pour éviter de surcharger le système. Il teste périodiquement si le service est rétabli avant de rétablir les appels. Cela protège et stabilise les systèmes distribués.

## 🚀 Implémentation

### Étape 1 : Logique du Circuit Breaker

La logique se trouve dans `circuit-breaker.ts` :

```ts
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
```

## 📋 Explication du Circuit Breaker NestJS

Ce code implémente un **Circuit Breaker** qui protège les appels à un service distant en gérant **3 états** :

### 🔒 États du Circuit Breaker

- **🟢 CLOSED (fermé)** : Appels autorisés normalement
- **🔴 OPEN (ouvert)** : Appels bloqués immédiatement après trop d'échecs
- **🟡 HALF_OPEN (semi-ouvert)** : Période de test où quelques appels sont autorisés pour vérifier si le service est rétabli

### ⚙️ Fonctionnement principal (`exec`)

- Si le circuit est **ouvert** et que le délai d'attente n'est pas écoulé, on rejette l'appel avec la dernière erreur
- Sinon, on exécute l'appel et on surveille le résultat :
  - ✅ **Succès** → `handleSuccess()`
  - ❌ **Échec** → `handleFailure()`

### ✅ Gestion des succès (`handleSuccess`)

- Réinitialise le compteur d'échecs
- En mode **half-open**, compte les succès consécutifs
- Si assez de succès consécutifs, referme le circuit

### ❌ Gestion des échecs (`handleFailure`)

- Incrémente le compteur d'échecs
- Si seuil dépassé ou en mode **half-open**, ouvre le circuit, sauvegarde l'erreur et bloque les appels pendant un délai

---

**💡 En résumé :**  
Ce pattern évite de surcharger un service défaillant en bloquant les appels après plusieurs erreurs, puis teste périodiquement pour rétablir la connexion quand le service revient.

---

## 🔧 Implémentation de l'Intercepteur

### Étape 2 : Intercepteur NestJS

On l'implémente dans `circuit-breaker.interceptor.ts` :

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CircuitBreaker } from './circuit-beaker';

@Injectable()
export class CircuitBreakerInterceptor implements NestInterceptor {
  private readonly circuitBreakerByHandler = new WeakMap<Function, CircuitBreaker>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const methodRef = context.getHandler();
    let circuitBreaker: CircuitBreaker;
    if (this.circuitBreakerByHandler.has(methodRef)) {
      circuitBreaker = this.circuitBreakerByHandler.get(methodRef) as CircuitBreaker;
    } else {
      circuitBreaker = new CircuitBreaker();
      this.circuitBreakerByHandler.set(methodRef, circuitBreaker);
    }
    return circuitBreaker.exec(next);
  }
}
```

## 📖 Explication de `CircuitBreakerInterceptor`

Ce fichier définit un **intercepteur NestJS** qui applique le pattern **Circuit Breaker** aux appels des méthodes des contrôleurs.

### 🔄 Fonctionnement principal

- Pour chaque méthode interceptée (`context.getHandler()`), on associe un **CircuitBreaker** unique via une `WeakMap`
- Si un circuit breaker existe déjà pour la méthode, on le réutilise
- Sinon, on crée un nouveau `CircuitBreaker` et on l'enregistre
- L'intercepteur délègue ensuite l'exécution à la méthode `exec` du circuit breaker, qui gère l'état (ouvert, fermé, semi-ouvert) et les erreurs

---

**💡 En résumé :**  
Cet intercepteur permet d'appliquer automatiquement un circuit breaker différent à chaque méthode d'un contrôleur, assurant ainsi la résilience de chaque endpoint individuellement.

---

## 🧪 Test du Circuit Breaker

### Étape 3 : Application dans le Contrôleur

On l'implémente dans le `CoffeesController` :

```ts
@Controller('coffees')
@UseInterceptors(CircuitBreakerInterceptor)
export class CoffeesController {
```

### 🎯 Simulation d'erreur

On lance une erreur dans la méthode `findAll` :

```ts
  @Get()
  findAll() {
    console.log('🦊 findAll executed');
    throw new RequestTimeoutException('💥 Error!');
    return this.coffeesService.findAll();
  }
```

### 🚀 Test en conditions réelles

Puis on lance dans le terminal :

```shell
for i in `seq 1 50`; do curl -w "\n" "http://localhost:3000/coffees"; done
```

**🎉 Résultat :** On remarque que seulement **3 erreurs** apparaissent dans le terminal. Le circuit a donc fonctionné !

### 🔄 Test de récupération

Après avoir attendu une minute (délai configuré), le circuit passe en état **HALF_OPEN**. Dans cet état :

- **1er appel** : L'appel est autorisé pour tester si le service fonctionne
- **Si l'appel échoue** : Le circuit repasse immédiatement en état **OPEN** pour 1 minute supplémentaire
- **Si l'appel réussit** : Le circuit reste en **HALF_OPEN** et autorise 2 autres appels de test
- **Après 3 succès consécutifs** : Le circuit repasse en état **CLOSED** (normal)

```shell
# Test après 1 minute d'attente
for i in `seq 1 10`; do curl -w "\n" "http://localhost:3000/coffees"; done
```

---

## 🎯 Avantages du Circuit Breaker

- **🛡️ Protection** : Évite la surcharge des services défaillants
- **⚡ Performance** : Réduit les temps d'attente en cas d'erreur
- **🔄 Résilience** : Permet la récupération automatique des services
- **📊 Monitoring** : Facilite le suivi de l'état des services