export class CacheController {
    lazyClear: Symbol = Symbol();

    clearAllCaches() {
        // Every caching function checks whether their clear symbol is
        // this current one. If they do not match, the cache is cleared
        // on the next method call.
        this.lazyClear = Symbol();
    }
}

export function CachedByString(controller: CacheController) {
    return <
        T extends { [k in K]: (this: T, arg: A, ...args: RA) => R },
        A extends string,
        RA extends any[],
        R,
        K extends PropertyKey,
    >(
        target: T,
        key: K,
        _descriptor: PropertyDescriptor,
    ): void => {
        let clear = controller.lazyClear;
        const original = target[key];
        let cache: Partial<Record<A, R>> = {};
        target[key] = (function (this: T, arg: A, ...args: RA): R {
            if (clear !== controller.lazyClear) {
                cache = {};
                clear = controller.lazyClear;
            } else if (arg in cache) return cache[arg]!;
            return cache[arg] = original.call(this, arg, ...args);
        }) as T[K];
    }
}

export function CachedByStringAsync(controller: CacheController) {
    return <
        T extends { [k in K]: (this: T, arg: A, ...args: RA) => Promise<R> },
        A extends string,
        RA extends any[],
        R,
        K extends PropertyKey,
    >(
        target: T,
        key: K,
        _descriptor: PropertyDescriptor,
    ): void => {
        let clear = controller.lazyClear;
        const original = target[key];
        let cache: Partial<Record<A, R>> = {};
        target[key] = (async function (this: T, arg: A, ...args: RA): Promise<R> {
            if (clear !== controller.lazyClear) {
                cache = {};
                clear = controller.lazyClear;
            } else if (arg in cache) return cache[arg]!;
            return cache[arg] = await original.call(this, arg, ...args);
        }) as T[K];
    }
}

const NOTHING = Symbol();

export function Cached(controller: CacheController) {
    return <
        T extends { [k in K]: (this: T, ...args: AR) => R },
        AR extends any[],
        R,
        K extends PropertyKey,
    >(
        target: T,
        key: K,
        _descriptor: PropertyDescriptor,
    ): void => {
        let clear = controller.lazyClear;
        const original = target[key];
        let cache: R | typeof NOTHING = NOTHING;
        target[key] = (function (this: T, ...args: AR): R {
            if (clear !== controller.lazyClear) {
                cache = NOTHING;
                clear = controller.lazyClear;
            } else if (cache !== NOTHING) return cache;
            return cache = original.call(this, ...args);
        }) as T[K];
    }
}

export function CachedAsync(controller: CacheController) {
    return <
        T extends { [k in K]: (this: T, ...args: AR) => Promise<R> },
        AR extends any[],
        R,
        K extends PropertyKey,
    >(
        target: T,
        key: K,
        _descriptor: PropertyDescriptor,
    ): void => {
        let clear = controller.lazyClear;
        const original = target[key];
        let cache: R | typeof NOTHING = NOTHING;
        target[key] = (async function (this: T, ...args: AR): Promise<R> {
            if (clear !== controller.lazyClear) {
                cache = NOTHING;
                clear = controller.lazyClear;
            } else if (cache !== NOTHING) return cache;
            return cache = await original.call(this, ...args);
        }) as T[K];
    }
}

export const __GAME_META_CACHE = new CacheController();
