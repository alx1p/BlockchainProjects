const path = require("path");
const fs = require("fs");

const parser = require("../parser/jaz.js").parser;

module.exports = include;

function error(ctx, ast, errStr) {
    ctx.error = {
        pos:   {
            first_line: ast.first_line,
            first_column: ast.first_column,
            last_line: ast.last_line,
            last_column: ast.last_column
        },
        errStr: errStr,
        errFile: ctx.fileName,
        ast: ast,
        message: errStr
    };
}

function include(ctx, ast) {
    if (!ast) {
        return error(ctx, ast, "Null AST");
    }
    if (ast.type == "BLOCK") {
        return includeBlock(ctx, ast);
    } else if (ast.type == "INCLUDE") {
        return includeInclude(ctx, ast);
    } else {
        return;
    }
}

function includeBlock(ctx, ast) {
    for (let i=0; i<ast.statements.length; i++) {
        include(ctx, ast.statements[i]);
        if (ctx.returnValue) return;
        if (ctx.error) return;
    }
}

function includeInclude(ctx, ast) {
    const incFileName = path.resolve(ctx.filePath, ast.file);
    const incFilePath = path.dirname(incFileName);

    ctx.includedFiles = ctx.includedFiles || [];
    if (ctx.includedFiles[incFileName]) return;

    ctx.includedFiles[incFileName] = true;

    const src = fs.readFileSync(incFileName, "utf8");

    if (!src) return error(ctx, ast, `Included file "${incFileName}" not found.`);

    const incAst = parser.parse(src);

    const oldFilePath = ctx.filePath;
    const oldFileName = ctx.fileName;
    ctx.filePath = incFilePath;
    ctx.fileName = incFileName;

    ast.block = incAst;
    ast.filePath = incFilePath;
    ast.fileName = incFileName;

    include(ctx, ast.block);

    ctx.filePath = oldFilePath;
    ctx.fileName = oldFileName;
}




