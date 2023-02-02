import fs from "node:fs/promises";
import path from "node:path";
import {__GAME_META_CACHE, CacheController, CachedAsync, CachedByString} from "./cache.js";
import {number, z} from "zod";

export class SummaryData {
    constructor(
        readonly version: string,
        private readonly __path: string,
    ) {
    }

    get path() {
        return this.__path;
    }

    private async __loadJson<S extends z.Schema>(local_path: string, schema: S): Promise<Readonly<z.TypeOf<S>>> {
        return schema.parse(JSON.parse(
            await fs.readFile(path.join(this.__path, local_path), "utf8")
        ));
    }

    @CachedAsync(__GAME_META_CACHE)
    getVersion() {
        return this.__loadJson("version.json", SummaryData.schema.Version);
    }

    @CachedAsync(__GAME_META_CACHE)
    getBlocks() {
        return this.__loadJson("blocks/data.min.json", SummaryData.schema.Blocks);
    }

    @CachedAsync(__GAME_META_CACHE)
    getWorldgenBiomes() {
        return this.__loadJson("data/worldgen/biome/data.min.json", SummaryData.schema.worldgen.Biomes);
    }
}

export namespace SummaryData {
    const __CACHE = new CacheController();

    export class ResourceLocation {
        private readonly __string: string;

        private constructor(
            readonly namespace: string,
            readonly path: string,
            readonly tag: boolean = false,
        ) {
            this.__string = `${tag ? "#" : ""}${namespace}:${path}`;
        }

        @CachedByString(__CACHE)
        static from(str: string): ResourceLocation {
            const col = str.indexOf(":");
            const tag = str[0] === "#";
            if (col === -1) return new ResourceLocation("minecraft", str.substring(+tag), tag);
            return new ResourceLocation(str.substring(+tag, col), str.substring(col + 1), tag);
        }

        is(other: this): boolean {
            return other === this || this.__string === other.__string;
        }

        toString() {
            return this.__string;
        }

        toJSON() {
            return this.__string;
        }

        static readonly schema = z.string().regex(/^#?([a-z0-9_.-]+:)?[a-z0-9_./-]+$/);

        static readonly parsingSchema = this.schema.transform(ResourceLocation.from);
    }

    export class ResourceMap<V> implements Iterable<[ResourceLocation, V]> {
        private constructor(private readonly __data: Partial<Record<string, V>>) {
        }

        get(key: ResourceLocation): V | undefined {
            return this.__data[key.toString()];
        }

        set(key: ResourceLocation, value: V): void {
            this.__data[key.toString()] = value;
        }

        delete(key: ResourceLocation): void {
            delete this.__data[key.toString()];
        }

        * keys(): IterableIterator<ResourceLocation> {
            let key;
            for (key in this.__data) yield ResourceLocation.from(key);
        }

        * values(): IterableIterator<V> {
            let key;
            for (key in this.__data) yield this.__data[key]!;
        }

        * entries(): IterableIterator<[ResourceLocation, V]> {
            let key;
            for (key in this.__data) yield [ResourceLocation.from(key), this.__data[key]!];
        }

        readonly [Symbol.iterator] = this.entries;

        toJSON() {
            return this.__data;
        }

        static readonly schema = <S extends z.Schema>(s: S) => z.record(ResourceLocation.schema, s);

        static readonly parsingSchema = <S extends z.Schema>(s: S) => this.schema(s)
            .transform(r => new this(Object.fromEntries(
                Object.entries(r).map(([k, v]) => [ResourceLocation.from(k).toString(), v])
            )));
    }

    export class ColorInt extends Number {
        constructor(num: number) {
            super(num | 0);
        }

        get alpha() {
            return (+this >> 24) & 0xff;
        }

        get red() {
            return (+this >> 16) & 0xff;
        }

        get green() {
            return (+this >> 8) & 0xff;
        }

        get blue() {
            return +this & 0xff;
        }

        static readonly schema = z.number().int().nonnegative().max(0xffffffff);

        static readonly parsingSchema = this.schema.transform(num => new this(num));
    }

    export const enum GenerationStep {
        RAW_GENERATION,
        LAKES,
        LOCAL_MODIFICATIONS,
        UNDERGROUND_STRUCTURES,
        SURFACE_STRUCTURES,
        STRONGHOLDS,
        UNDERGROUND_ORES,
        UNDERGROUND_DECORATION,
        FLUID_SPRINGS,
        VEGETAL_DECORATION,
        TOP_LAYER_MODIFICATION,
    }

    export class GenerationFeatures<V> implements Iterable<V> {
        constructor(private readonly __data: [V, V, V, V, V, V, V, V, V, V, V]) {
        }

        getStep(step: GenerationStep): V {
            return this.__data[step];
        }

        setStep(step: GenerationStep, value: V): void {
            this.__data[step] = value;
        }

        [Symbol.iterator]() {
            return this.__data.values();
        }

        toJSON() {
            return this.__data;
        }

        static readonly schema = <
            S extends z.Schema<O, z.ZodTypeDef, any>,
            O extends readonly any[] | readonly []
        >(s: S) => s.array().max(11).transform(x => {
            type ST = z.TypeOf<S>;
            while (x.length < 11) x.push([] as any);
            return x as [ST, ST, ST, ST, ST, ST, ST, ST, ST, ST, ST];
        });

        static readonly parsingSchema = <
            S extends z.Schema<O, z.ZodTypeDef, any>,
            O extends readonly any[] | readonly []
        >(s: S) => this.schema(s).transform(d => new this(d));
    }

    export namespace schema {

        export const Version = z.strictObject({
            id: z.string(),
            name: z.string(),
            release_target: z.string().nullable(),
            type: z.enum(["snapshot", "release"]),
            stable: z.boolean(),
            data_version: z.number(),
            protocol_version: z.number(),
            data_pack_version: z.number(),
            resource_pack_version: z.number(),
            build_time: z.string().datetime({offset: true}),
            release_time: z.string().datetime({offset: true}),
            sha1: z.string(),
        });
        export type Version = z.TypeOf<typeof Version>;
        export const VersionArray = z.array(Version);
        export type VersionArray = Version[];

        export const Blocks = ResourceMap.parsingSchema(
            z.tuple([
                z.record(z.string(), z.string().array()),
                z.record(z.string(), z.string()),
            ])
        );
        export type Blocks = z.TypeOf<typeof Blocks>;

        export namespace worldgen {
            const SpawnersConfiguration = z.strictObject({
                type: ResourceLocation.parsingSchema,
                weight: z.number().int().nonnegative(),
                minCount: z.number().int().min(1),
                maxCount: z.number().int().min(1),
            }).array();
            export const Biomes = ResourceMap.parsingSchema(
                z.object({
                    temperature: z.number(),
                    temperature_modifier: z.enum(["none", "frozen"]).default("none"),
                    downfall: z.number(),
                    effects: z.strictObject({
                        fog_color: ColorInt.parsingSchema,
                        sky_color: ColorInt.parsingSchema,
                        water_color: ColorInt.parsingSchema,
                        water_fog_color: ColorInt.parsingSchema,
                        foliage_color: ColorInt.parsingSchema.optional(),
                        grass_color: ColorInt.parsingSchema.optional(),
                        grass_color_modifier: z.enum(["none", "dark_forest", "swamp"]).default("none"),
                        particle: z.strictObject({
                            probability: z.number(),
                            options: z.any(), // TODO
                        }).optional(),
                        ambient_sound: ResourceLocation.parsingSchema.optional(),
                        mood_sound: z.strictObject({
                            sound: ResourceLocation.parsingSchema,
                            tick_delay: number().int().nonnegative(),
                            block_search_extent: number().int().nonnegative(),
                            offset: number().nonnegative(),
                        }).optional(),
                        additions_sound: z.strictObject({
                            sound: ResourceLocation.parsingSchema,
                            tick_chance: z.number(),
                        }).optional(),
                        music: z.strictObject({
                            sound: ResourceLocation.parsingSchema,
                            min_delay: z.number().nonnegative(),
                            max_delay: z.number().nonnegative(),
                            replace_current_music: z.boolean(),
                        }).optional(),
                    }),
                    carvers: z.strictObject({
                        // TODO: Support carver object(s)
                        air: ResourceLocation.parsingSchema.or(ResourceLocation.parsingSchema.array()).default([]),
                        liquid: ResourceLocation.parsingSchema.or(ResourceLocation.parsingSchema.array()).default([]),
                    }),
                    features: GenerationFeatures.parsingSchema(ResourceLocation.parsingSchema.array()),
                    creature_spawn_probability: z.number().nonnegative().max(0.9999999).default(0),
                    spawners: z.object({
                        monster: SpawnersConfiguration,
                        creature: SpawnersConfiguration,
                        ambient: SpawnersConfiguration,
                        water_creature: SpawnersConfiguration,
                        underground_water_creature: SpawnersConfiguration,
                        water_ambient: SpawnersConfiguration,
                        misc: SpawnersConfiguration,
                        axolotls: SpawnersConfiguration,
                    }).partial(),
                    spawn_costs: ResourceMap.parsingSchema(z.strictObject({
                        energy_budget: z.number().nonnegative(),
                        charge: z.number().nonnegative(),
                    })),
                }).and(
                    z.object({
                        precipitation: z.enum(["none", "rain", "snow"]),
                    }).or(z.object({
                        has_precipitation: z.boolean(),
                    })).transform(obj => ({
                        precipitation: "has_precipitation" in obj
                            ? obj.has_precipitation ? "rain" : "none"
                            : obj.precipitation
                    }))
                )
            );
        }
    }
}
