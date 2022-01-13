module.exports = function(ctx, ast) {
    precheck(ctx, ast);
    if (ctx.error) return;
    check(ctx, ast);
};

function precheck(ctx, ast) {
    if (!ast) {
        return error(ctx, ast, "Null AST");
    } else if (!ast.type) {
        return error(ctx, ast, "Null AST Type");
    } else if (ast.type == "INCLUDE") {
        if (ast.block) {
            const oldFilePath = ctx.filePath;
            const oldFileName = ctx.fileName;
            ctx.filePath = ast.filePath;
            ctx.fileName = ast.fileName;

            precheck(ctx, ast.block);

            ctx.filePath = oldFilePath;
            ctx.fileName = oldFileName;
        } else {
        // No block means that the includer has already included this...
        }
    } else if (ast.type == "TEMPLATEDEF") {
        storeType(ctx, ast, ast.name, "T_TEMPLATE", false, true);
        ctx.typeScopes.push({});
        precheck(ctx, ast.block);
        ctx.typeScopes.pop();
    } else if (ast.type == "FUNCTIONDEF") {
        storeType(ctx, ast, ast.name, "T_FUNCTION", false, true);
        ctx.typeScopes.push({});

        precheck(ctx, ast.block);

        ctx.typeScopes.pop();
    } else if (ast.type == "BLOCK") {
        for (let i=0; i<ast.statements.length; i++) {
            precheck(ctx, ast.statements[i]);
            if (ctx.error) return;
        }
    } else if (ast.type == "COMPUTEBLOCK") {
        for (let i=0; i<ast.statements.length; i++) {
            precheck(ctx, ast.statements[i]);
            if (ctx.error) return;
        }

    }
}


function check(ctx, ast) {
    if (!ast) {
        return error(ctx, ast, "Null AST");
    }
    if ((ast.type == "NUMBER")) {
        ast.kind = "T_FIELD";
    } else if ( (ast.type == "LINEARCOMBINATION") || (ast.type =="SIGNAL") || (ast.type == "QEQ")) {
        throw `Unknown AST node type ${ast.type}"`;
    } else if (ast.type == "VARIABLE") {
        checkVar(ctx, ast);
    } else if (ast.type == "PIN") {
        ast.kind = "T_FIELD";
    } else if (ast.type == "OP") {
        checkOp(ctx, ast);
    } else if (ast.type == "DECLARE") {
        checkDecl(ctx, ast);
    } else if (ast.type == "FUNCTIONCALL") {
        checkFunctionCall(ctx, ast);
    } else if (ast.type == "BLOCK") {
        checkBlock(ctx, ast);
    } else if (ast.type == "COMPUTEBLOCK") {
        checkBlock(ctx, ast);
    } else if (ast.type == "FOR") {
        checkFor(ctx, ast);
    } else if (ast.type == "WHILE") {
        checkWhile(ctx, ast);
    } else if (ast.type == "IF") {
        checkIf(ctx, ast);
    } else if (ast.type == "RETURN") {
        ast.kind = "T_UNIT";
    } else if (ast.type == "TEMPLATEDEF") {
        checkTemplateDef(ctx, ast);
    } else if (ast.type == "FUNCTIONDEF") {
        checkFunctionDef(ctx, ast);
    } else if (ast.type == "INCLUDE") {
        checkInclude(ctx, ast);
    } else if (ast.type == "INTCAST") {
        check(ctx, ast.expression);
        ast.kind = "T_INT";
    } else if (ast.type == "LOG") {
        check(ctx, ast.expression);
        ast.kind = ast.expression.kind;
    } else if (ast.type == "FIELDCAST") {
        check(ctx, ast.expression);
        ast.kind = "T_FIELD";
    } else if (ast.type == "ARRAY") {
        checkArray(ctx, ast);
    } else {
        error(ctx, ast, "Invalid AST node type: " + ast.type);
    }
}

function checkOp(ctx, ast) {
    for (let i=0; i<ast.values.length; i++) {
        check(ctx, ast.values[i]);
        if (ctx.error) return;
    }
    switch (ast.op) {
    case "=":
    case "<--":
    case "<==":
    case "===":
    case "+=":
    case "*=":
        if (ast.values[0].kind != ast.values[1].kind)
            error(ctx, ast, `Left type "${ast.values[0].kind}" does not equal right ${ast.values[1].kind}"`);
        ast.kind = ast.values[0].kind;
        break;

    case "+":
    case "-":
    case "*":
    case "%":
    case "/":
    case "\\":
    case "**":
    case "&":
    case "<<":
    case ">>":
        if (ast.values[0].kind != ast.values[1].kind)
            error(ctx, ast, `Left type "${ast.values[0].kind}" does not equal right ${ast.values[1].kind}"`);
        ast.kind = ast.values[0].kind;
        break;

    case "PLUSPLUSRIGHT":
    case "PLUSPLUSLEFT":
    case "MINUSMINUSRIGHT":
    case "MINUSMINUSLEFT":
    case "UMINUS":
        if (!typeIsNumeric(ast.values[0].kind))
            error(ctx, ast, `Type "${ast.values[0].kind}" is not numeric`);
        ast.kind = ast.values[0].kind;
        break;

    case "&&":
    case "||":
        if (ast.values[0].kind != "T_BOOL")
            error(ctx, ast, `Type "${ast.values[0].kind}" is not boolean`);
        if (ast.values[1].kind != "T_BOOL")
            error(ctx, ast, `Type "${ast.values[1].kind}" is not boolean`);
        ast.kind = "T_BOOL";
        break;

    case "<":
    case ">":
    case "<=":
    case ">=":
    case "==":
    case "!=":
        if (ast.values[0].kind != ast.values[1].kind)
            error(ctx, ast, `Left type "${ast.values[0].kind}" does not equal right ${ast.values[1].kind}"`);
        ast.kind = "T_BOOL";
        break;

    case "?":
        if (ast.values[0].kind != "T_BOOL")
            error(ctx, ast, `Test type "${ast.values[0].kind}" is not boolean`);
        if (ast.values[1].kind != ast.values[2].kind)
            error(ctx, ast, `True type "${ast.values[1].kind}" does not equal false type ${ast.values[2].kind}"`);
        ast.kind = ast.values[1].kind;
        break;
    default:
        error(ctx, ast, "Invalid operation: " + ast.op);
    }
}

function typeIsNumeric(type) {
    return type == "T_INT" || type == "T_FIELD";
}

function checkFunctionCall(ctx, ast) {
    for (const param of ast.params) {
        check(ctx, param);
        if (ctx.error) return;
    }

    const functionType = getType(ctx, ast.name);
    if (!functionType) {
        error(ctx, ast, `Unknown function/template "${ast.name}"`);
    }
    switch (functionType) {
    case "T_FUNCTION":
        ast.kind = "T_FIELD";
        break;
    case "T_TEMPLATE":
        ast.kind = "T_COMPONENT";
        break;
    default:
        error(ctx, ast, `Invalid function/template type "${functionType}" for "${ast.name}"`);
        break;

    }
}

function checkVar(ctx, ast) {
    const kind = getType(ctx, ast.name);
    if (!kind) {
        error(ctx, ast, `Unknown identifier "${ast.name}"`);
    }
    ast.kind = kind;
}

function getType(ctx, id) {
    for (var i = ctx.typeScopes.length - 1; i >= 0; i--) {
        if (id in ctx.typeScopes[i]) {
            return ctx.typeScopes[i][id];
        }
    }
    return null;
}

function inTopScope(ctx, id) {
    return id in ctx.typeScopes[ctx.typeScopes.length - 1];
}

function storeType(ctx, ast, id, type, allowShadow, topLevel) {
    if (allowShadow ? inTopScope(ctx, id) : getType(ctx, id)) {
        error(ctx, ast, `An identifier with name "${id}" was declared, but that name is already used`);
    }

    const scope = ctx.typeScopes[ topLevel ? 0 : ctx.typeScopes.length-1];
    scope[id] = type;
}

function checkTemplateDef(ctx, ast) {
    ctx.typeScopes.push({});
    for (const param of ast.params) {
        storeType(ctx, ast, param, "T_FIELD", true, false);
    }

    check(ctx, ast.block);

    ctx.typeScopes.pop();
}

function checkFunctionDef(ctx, ast) {
    ctx.typeScopes.push({});
    for (const param of ast.params) {
        storeType(ctx, ast, param, "T_FIELD", true, false);
    }

    check(ctx, ast.block);

    ctx.typeScopes.pop();
}

function checkInclude(ctx, ast) {
    if (ast.block) {
        const oldFilePath = ctx.filePath;
        const oldFileName = ctx.fileName;
        ctx.filePath = ast.filePath;
        ctx.fileName = ast.fileName;

        check(ctx, ast.block);

        ctx.filePath = oldFilePath;
        ctx.fileName = oldFileName;
    } else {
        // No block means that the includer has already included this...
    }
}

function checkDecl(ctx, ast) {
    storeType(ctx, ast, ast.name.name, ast.kind, true, false);
}

function checkBlock(ctx,  ast) {
    for (let i=0; i<ast.statements.length; i++) {
        check(ctx, ast.statements[i]);
        if (ctx.error) return;
    }
}

function checkFor(ctx,  ast) {
    ctx.typeScopes.push({});

    check(ctx, ast.init);
    if (ctx.error) return;
    check(ctx, ast.condition);
    if (ctx.error) return;
    check(ctx, ast.step);
    if (ctx.error) return;
    check(ctx, ast.body);

    ctx.typeScopes.pop();
    ast.kind = "T_UNIT";
}

function checkWhile(ctx,  ast) {
    check(ctx, ast.condition);
    if (ctx.error) return;

    ctx.typeScopes.push({});

    check(ctx, ast.body);

    ctx.typeScopes.pop();
    ast.kind = "T_UNIT";
}

function checkIf(ctx,  ast) {
    check(ctx, ast.condition);
    if (ctx.error) return;
    check(ctx, ast.then);
    if (ctx.error) return;
    if (ast.else) {
        check(ctx, ast.else);
    }
    ast.kind = "T_UNIT";
}

function checkArray(ctx, ast) {
    const types = {};

    for (const elem of ast.values) {
        check(ctx, elem);
        types[elem.kind] = 1;
    }
    if (Object.keys(types).length != 1) {
        error(ctx, ast, `Arrays must be homogeneous and non-empty. Types: ${Object.keys(types)}`);
    }
    ast.kind = Object.keys(types)[0];
}

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
