let lazyClear: Symbol = Symbol();

export function clearAllCaches() {
    // Every caching function checks whether their clear symbol is
    // this current one. If they do not match, the cache is cleared
    // on the next method call.
    lazyClear = Symbol();
}

export function CachedByString<
    T extends { [k in K]: (this: T, arg: A, ...args: RA) => Promise<R> },
    A extends string,
    RA extends any[],
    R,
    K extends PropertyKey,
>(
    target: T,
    key: K,
    _descriptor: PropertyDescriptor,
): void {
    let clear = lazyClear;
    const original = target[key];
    let cache: Partial<Record<A, R>> = {};
    target[key] = (async function(this: T, arg: A, ...args: RA): Promise<R> {
        if (clear !== lazyClear) {
            cache = {};
            clear = lazyClear;
        }
        else if (arg in cache) return cache[arg]!;
        return cache[arg] = await original.call(this, arg, ...args);
    }) as T[K];
}

const NOTHING = Symbol();

export function Cached<
    T extends { [k in K]: (this: T, ...args: AR) => Promise<R> },
    AR extends any[],
    R,
    K extends PropertyKey,
>(
    target: T,
    key: K,
    _descriptor: PropertyDescriptor,
): void {
    let clear = lazyClear;
    const original = target[key];
    let cache: R | typeof NOTHING = NOTHING;
    target[key] = (async function(this: T, ...args: AR): Promise<R> {
        if (clear !== lazyClear) {
            cache = NOTHING;
            clear = lazyClear;
        }
        else if (cache !== NOTHING) return cache;
        return cache = await original.call(this, ...args);
    }) as T[K];
}
