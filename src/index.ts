import {constants as fs_constants, createWriteStream, type Stats} from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import https from "node:https";
import {createGunzip} from "node:zlib";
import {pipeline} from "node:stream/promises";
import assert from "node:assert/strict";

import tar from "tar";

import {SummaryData} from "./summaryData.js";
import {Cached, CachedByString, clearAllCaches} from "./cache.js";

const TEMP = path.resolve(fileURLToPath(import.meta.url), "../../temp");
const MAX_CACHE_MS = 2 * 60 * 60 * 1000; // 2h

// noinspection JSUnusedLocalSymbols
export class GameMeta {
    private constructor() {
        throw new Error("Cannot be instantiated");
    }

    static async clearCache(): Promise<void> {
        await fs.rm(TEMP, {recursive: true, force: true});
        clearAllCaches();
    }

    @Cached
    static async loadVersions(): Promise<SummaryData.VersionArray> {
        await fs.mkdir(TEMP, {recursive: true});
        const versionsFile = path.resolve(TEMP, "versions.json");
        let stats: Stats | null;
        try {
            stats = await fs.stat(versionsFile);
        } catch (e: any) {
            if (e.code === "ENOENT") {
                stats = null;
            } else throw e;
        }
        if (stats !== null && Date.now() - stats.mtimeMs > MAX_CACHE_MS) {
            return SummaryData.VersionArray.parse(await fs.readFile(versionsFile));
        }

        await new Promise((resolve, reject) => {
            const req = https.get("https://raw.githubusercontent.com/misode/mcmeta/summary/versions/data.json.gz");
            req.once("response", res => {
                if (res.statusCode! < 200 || res.statusCode! >= 400) {
                    reject(new Error(`Unable to load version data (${res.statusMessage!})`));
                }

                pipeline(res, createGunzip(), createWriteStream(versionsFile, "utf8"))
                    .then(resolve);
            });
        });

        return SummaryData.VersionArray.parse(JSON.parse(await fs.readFile(versionsFile, "utf8")));
    }

    @CachedByString
    static async loadVersionSummary(version: string): Promise<SummaryData> {
        assert.match(version, /^[a-zA-Z0-9][a-zA-Z0-9_+.-]+$/);

        const dataDir = path.resolve(TEMP, "version", version);
        try {
            await fs.access(dataDir, fs_constants.R_OK);
            return new SummaryData(version, dataDir);
        } catch (e: any) {
            if (e.code !== "ENOENT") throw e;
        }

        await fs.mkdir(dataDir, {recursive: true});
        await new Promise((resolve, reject) => {
            const req = https.get(`https://codeload.github.com/misode/mcmeta/tar.gz/refs/tags/${version}-summary`);
            req.once("response", res => {
                if (res.statusCode! < 200 || res.statusCode! >= 400) {
                    reject(new Error(`Unable to load version summary (${res.statusMessage!})`));
                }

                pipeline(res, tar.extract({
                    cwd: dataDir,
                    strip: 1,
                    filter: (path) => {
                        path = path.replace(/^[^/]+\//, "");
                        return path === "version.json" || path.endsWith(".min.json") && path !== "versions/data.min.json";
                    }
                }))
                    .then(resolve)
                    .catch(err => {
                        fs.rm(dataDir, {recursive: true, force: true});
                        reject(err);
                    });
            });
        });

        return new SummaryData(version, dataDir);
    }
}
