import fs from "node:fs/promises";
import path from "node:path";
import {Cached} from "./cache.js";
import {z} from "zod";

export class SummaryData {
    constructor(
        readonly version: string,
        private readonly __path: string,
    ) {
    }

    get path() {
        return this.__path;
    }

    private async __loadJson<S extends z.Schema>(local_path: string, schema: S): Promise<z.TypeOf<S>> {
        return schema.parse(JSON.parse(
            await fs.readFile(path.join(this.__path, local_path), "utf8")
        ));
    }

    @Cached
    getVersion() {
        return this.__loadJson("version.json", SummaryData.Version);
    }

    @Cached
    getBlocks() {
        return this.__loadJson("blocks/data.min.json", SummaryData.Blocks);
    }
}

export namespace SummaryData {
    export const Version = z.object({
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

    export const Blocks = z.record(
        z.string(),
        z.tuple([
            z.record(z.string(), z.string().array()),
            z.record(z.string(), z.string()),
        ]),
    );
    export type Blocks = z.TypeOf<typeof Blocks>;
}
