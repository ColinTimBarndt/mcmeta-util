import assert from "node:assert/strict";
import {GameMeta} from "mcmeta-util";

await GameMeta.clearCache();

const versions = await GameMeta.loadVersions();

const VERSION_1_19_2 = Object.freeze({
    id: "1.19.2",
    name: "1.19.2",
    release_target: "1.19.2",
    type: "release",
    stable: true,
    data_version: 3120,
    protocol_version: 760,
    data_pack_version: 10,
    resource_pack_version: 9,
    build_time: "2022-08-05T11:55:20+00:00",
    release_time: "2022-08-05T11:57:05+00:00",
    sha1: "68cded4616fba9fbefb3f895033c261126c5f89c",
});

assert(versions.length > 0);
assert.deepStrictEqual(
    versions.find(ver => ver.id === "1.19.2"),
    {...VERSION_1_19_2, sha1: "678862600e99991a2bf1d434af69ded3a321e22a"},
);

const ver = await GameMeta.loadVersionSummary("1.19.2");

assert.equal(ver.version, "1.19.2");
assert.deepStrictEqual(await ver.getVersion(), VERSION_1_19_2);

const blocks = await ver.getBlocks();
assert.deepStrictEqual(
    blocks.acacia_button,
    [
        {
            "face": [
                "floor",
                "wall",
                "ceiling"
            ],
            "facing": [
                "north",
                "south",
                "west",
                "east"
            ],
            "powered": [
                "true",
                "false"
            ]
        },
        {
            "face": "wall",
            "facing": "north",
            "powered": "false"
        }
    ]
);
