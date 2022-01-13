#!/usr/bin/env node

/*
    Copyright 2018 0KIMS association.

    This file is part of circom (Zero Knowledge Circuit Compiler).

    circom is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    circom is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with circom. If not, see <https://www.gnu.org/licenses/>.
*/

/* eslint-disable no-console */

const path = require("path");
const fs = require("fs");

const compiler = require("./src/compiler");

const version = require("./package").version;

const argv = require("yargs")
    .version(version)
    .usage("circom [input source circuit file] -o [output definition circuit file]")
    .alias("o", "output")
    .help("h")
    .alias("h", "help")
    .boolean("verbose")
    .alias("v", "verbose")
    .describe("v", "print status messages")
    .boolean("fast")
    .alias("f", "fast")
    .describe("f", "don't optimize constraints")
    .epilogue(`Copyright (C) 2018  0kims association
    This program comes with ABSOLUTELY NO WARRANTY;
    This is free software, and you are welcome to redistribute it
    under certain conditions; see the COPYING file in the official
    repo directory at  https://github.com/iden3/circom `)
    .argv;

let inputFile;
if (argv._.length == 0) {
    inputFile = "circuit.circom";
} else if (argv._.length == 1) {
    inputFile = argv._[0];
} else  {
    console.log("Only one circuit at a time is permited");
    process.exit(1);
}

function leftPad(num, rep, len) {
    return rep.repeat(len - String(num).length) + num;
}

function errorLocationString(err) {
    const { errFile, pos } = err;
    const { first_line, first_column, last_line, last_column } = pos;

    const fStr = String(fs.readFileSync(errFile));
    const lines = fStr.split(/\r?\n/);
    const linesToShow = Array.from(lines.entries()).slice(first_line - 2, last_line + 1);

    let str = "";

    let maxlinenowidth = Math.max(...linesToShow.map((pair) => String(pair[0] + 1).length));

    for (const [lineno, line] of linesToShow) {
        str += `${leftPad(lineno + 1, " ", maxlinenowidth + 1)}|${line}\n`;
        if (first_line == last_line && lineno == first_line - 1) {
            str += " ".repeat(maxlinenowidth + 2 + first_column);
            str += "^".repeat(last_column - first_column);
            str += "\n";
        }
    }
    return str;
}

function streamingWrite(path, json) {
    const fd = fs.openSync(path, "w");
    function helper(fd, json) {
        switch (typeof json) {
        case "object":
            if (json === null) {
                fs.writeSync(fd, "null");
            } else if (Array.isArray(json)) {
                fs.writeSync(fd, "[");
                {
                    let first = true;
                    for (let val of json) {
                        if (first) {
                            first = false;
                        } else {
                            fs.writeSync(fd, ",");
                        }
                        helper(fd, val);
                    }
                }
                fs.writeSync(fd, "]");
                break;
            }else {
                fs.writeSync(fd, "{");
                {
                    let first = true;
                    for (let key in json) {
                        if (first) {
                            first = false;
                        } else {
                            fs.writeSync(fd, ",");
                        }
                        fs.writeSync(fd, JSON.stringify(key));
                        fs.writeSync(fd, ": ");
                        helper(fd, json[key]);
                    }
                }
                fs.writeSync(fd, "}");
            }
            break;
        case "string":
        case "number":
        case "boolean":
            fs.writeSync(fd, JSON.stringify(json));
            break;
        default:
            throw `Unknown type ${typeof json}`;
        }
    }
    helper(fd, json);
}

const fullFileName = path.resolve(process.cwd(), inputFile);
const outName = argv.output ? argv.output : "circuit.json";

compiler(fullFileName, {reduceConstraints: !argv.fast, verbose: !!argv.verbose}).then( (cir) => {
    if (argv.verbose) console.log(`STATUS: Writing circuit to: ${outName}`);
    streamingWrite(outName, cir);
    process.exit(0);
}, (err) => {
    if (err.pos) {
        console.error(`ERROR at ${err.errFile}:${err.pos.first_line},${err.pos.first_column}-${err.pos.last_line},${err.pos.last_column}\n${err.errStr}\n\n${errorLocationString(err)}`);
        if (argv.verbose) console.log(err.stack);
    } else {
        console.log(err.message);
        if (argv.verbose) console.log(err.stack);
    }
    process.exit(1);
});
