// ============================================
// CORE PREPROCESSOR - Motor de Processamento
// ============================================
// Com suporte a operadores matemáticos, condicionais, definição e indexação

const maxIterations = 512;

// === EXTRAÇÃO DE BLOCO BALANCEADO ===
function extractBlock(src, openpos, open, close) {
    let i = openpos;
    let depth = 0;
    let startInner = null;
    let inString = false;
    let strChar = '';
    while (i < src.length) {
        let ch = src[i];
        if (inString) {
            if (ch === '\\') {
                i += 2;
                continue;
            }
            if (ch === strChar) {
                inString = false;
                strChar = '';
            }
            i++;
            continue;
        } else {
            if (ch === '"' || ch === "'") {
                inString = true;
                strChar = ch;
                i++;
                continue;
            }
        }
        if (ch === open) {
            depth++;
            if (startInner === null) {
                startInner = i + 1;
            }
        } else if (ch === close) {
            depth--;
            if (depth === 0) {
                const inner = startInner !== null 
                    ? src.substring(startInner, i) 
                    : '';
                const posAfterClose = i + 1;
                return [inner, posAfterClose];
            }
        }
        i++;
    }
    const inner = startInner !== null 
        ? src.substring(startInner) 
        : '';
    return [inner, src.length];
}

// === COLETA DE MACROS ===
function collectMacros(src) {
    const macros = {};
    const macroRegex = /\bmacro\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
    let match;
    const matches = [];
    while ((match = macroRegex.exec(src)) !== null) {
        matches.push({
            name: match[1],
            matchStart: match.index,
            openPos: match.index + match[0].length - 1
        });
    }
    for (let j = matches.length - 1; j >= 0; j--) {
        const m = matches[j];
        const [body, posAfter] = extractBlock(src, m.openPos, '{', '}');
        macros[m.name] = body;
        src = src.substring(0, m.matchStart) + src.substring(posAfter);
    }
    return [macros, src];
}
// === EXPANSÃO DE MACROS ===
function expandMacros(src, macros) {
    for (const name of Object.keys(macros)) {
        const body = macros[name];
        let changed = true;
        while (changed) {
            changed = false;
            const pattern = new RegExp(
                `\\b${escapeRegex(name)}\\b(?:\\s*\\(\\s*([^()]*)\\s*\\)|(?:\\s+([^\
{};()]+(?:\\s+[^\
{};()]+)*)))`,
                'g'
            );
            src = src.replace(pattern, (match, p1, p2) => {
                changed = true;
                const argsRaw = (p1 !== undefined && p1.length > 0) ? p1 : p2;
                let vals = [];
                if (p1 !== undefined && p1.length > 0) {
                    vals = p1.split(',').map(v => v.trim());
                } else {
                    vals = argsRaw.trim().split(/\s+/);
                }
                let exp = body;
                exp = exp.replace(/\$0\b/g, name);
                for (let i = 0; i < vals.length; i++) {
                    const n = i + 1;
                    const v = vals[i];
                    exp = exp.replace(new RegExp(`\\$${n}(?!\\d)`, 'g'), v);
                }
                exp = exp.replace(/\$\d+\b/g, '');
                return exp;
            });
        }
    }
    return src;
}

// === CONVERSÃO DE STRINGS "..." ===
function convertDoubleQuoteStrings(src) {
    const defs = [];
    let counter = 0;
    src = src.replace(
        /"((?:\\.|[^"\\]|\n)*)"/g,
        (match, content) => {
            const id = `_unamed_string${counter}`;
            counter++;
            let formatted = content
                .replace(/\n/g, '\\n')
                .replace(/ /g, '\\s');
            defs.push(`protected ${id} {\\${formatted}}`);
            return `pointer(mem, ${id})`;
        }
    );
    if (defs.length > 0) {
        src = defs.join('\n') + '\n' + src;
    }
    return src;
}

// === REMOÇÃO DE COMENTÁRIOS ===
function removeComments(src) {
    return src.replace(/\/\/[^\n\r\t]*/g, '');
}

// Resolve completamente uma expressão de indexação aninhada para a forma plana
// Ex: a[b[c[d]]] -> get(mem, get(mem, get(mem, a, b), c), d)
function resolveNestedIndex(indexExpr) {
    let i = 0;
    let depth = 0;
    let deepestStart = -1;
    let deepestEnd = -1;
    let deepestOuterStart = -1;
    let deepestOuterEnd = -1;
    let inString = false;
    let strChar = '';

    while (i < indexExpr.length) {
        let ch = indexExpr[i];
        if (inString) {
            if (ch === '\\') {
                i += 2;
                continue;
            }
            if (ch === strChar) {
                inString = false;
                strChar = '';
            }
            i++;
            continue;
        } else {
            if (ch === '"' || ch === "'") {
                inString = true;
                strChar = ch;
                i++;
                continue;
            }
        }

        if (ch === '[') {
            if (depth === 0) {
                deepestOuterStart = i;
            }
            depth++;
        } else if (ch === ']') {
            depth--;
            if (depth === 0 && deepestOuterStart !== -1) {
                deepestOuterEnd = i;
                // @ é parte do identificador desde o início
                const match = indexExpr.match(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*\[\s*([^\[\]]+)\s*\]$/);
                if (match) {
                    const innerBase = match[1];
                    const innerIndex = match[2];
                    const prefix = indexExpr.substring(0, match.index);
                    const newExpr = prefix + `get(mem, ${innerBase}, ${innerIndex})`;
                    return resolveNestedIndex(newExpr);
                } else {
                    return indexExpr;
                }
            }
        }
        i++;
    }
    return indexExpr;
}


// === CONVERSÃO DE INDEXAÇÃO a[b] E a[b[c[d...]]] E a[b][c][d] ===
function convertIndexation(src) {
    let changed = true;
    let iterations = 0;
    
    
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        const originalSrc = src;
        
        // Procura por cadeias de indexação: base[...]
        // Usamos uma abordagem mais direta: encontramos manualmente
        let i = 0;
        let result = '';
        
        while (i < src.length) {
            // Tenta encontrar o próximo identificador + indexação
            const remaining = src.substring(i);
            const match = remaining.match(/^(@?[A-Za-z_][@A-Za-z0-9_]*)/);
            
            if (!match) {
                result += remaining.substring(0, 1);
                i++;
                continue;
            }
            
            const base = match[0];
            let j = i + base.length;
            
            // Verifica se há indexações após a base
            let hasIndexation = false;
            let indices = [];
            let k = j;
            
            while (k < src.length) {
                // Pula espaços
                while (k < src.length && src[k] === ' ') {
                    k++;
                }
                
                if (k >= src.length || src[k] !== '[') {
                    break;
                }
                
                // Encontra o índice balanceando colchetes
                let depth = 0;
                let indexStart = k + 1;
                let inString = false;
                let strChar = '';
                let kk = k;
                
                while (kk < src.length) {
                    let ch = src[kk];
                    
                    if (inString) {
                        if (ch === '\\') {
                            kk += 2;
                            continue;
                        }
                        if (ch === strChar) {
                            inString = false;
                            strChar = '';
                        }
                    } else {
                        if (ch === '"' || ch === "'") {
                            inString = true;
                            strChar = ch;
                        } else if (ch === '[') {
                            depth++;
                        } else if (ch === ']') {
                            depth--;
                            if (depth === 0) {
                                const indexContent = src.substring(indexStart, kk).trim();
                                indices.push(indexContent);
                                k = kk + 1;
                                hasIndexation = true;
                                break;
                            }
                        }
                    }
                    kk++;
                }
                
                if (depth !== 0) {
                    break; // Indexação malformada
                }
            }
            
            if (hasIndexation) {
                changed = true;
                // Verifica se é uma atribuição
                let afterIndices = k;
                while (afterIndices < src.length && src[afterIndices] === ' ') {
                    afterIndices++;
                }
                
                if (afterIndices < src.length && src[afterIndices] === '=' && 
                    (afterIndices + 1 >= src.length || src[afterIndices + 1] !== '=')) {
                    // É uma atribuição: a[b][c] = value
                    afterIndices++; // Pula o =
                    while (afterIndices < src.length && src[afterIndices] === ' ') {
                        afterIndices++;
                    }
                    
                    // Encontra o valor (até quebra de linha, ponto-e-vírgula ou fim)
                    let valueStart = afterIndices;
                    let valueEnd = valueStart;
                    while (valueEnd < src.length && src[valueEnd] !== '\n' && src[valueEnd] !== ';') {
                        valueEnd++;
                    }
                    
                    const value = src.substring(valueStart, valueEnd).trim();
                    
                    // Constrói a expressão de indexação
                    let expr = base;
                    for (const idx of indices) {
                        if (idx.includes('[') && idx.includes(']')) {
                            const resolvedIdx = resolveNestedIndex(idx);
                            expr = `get(mem, ${expr}, ${resolvedIdx})`;
                        } else {
                            expr = `get(mem, ${expr}, ${idx})`;
                        }
                    }
                    
                    // Gera set(mem, expr, value)
                    result += `set(mem, ${expr}, ${value})`;
                    i = valueEnd;
                } else {
                    // É um acesso, convertemos
                    let expr = base;
                    for (const idx of indices) {
                        if (idx.includes('[') && idx.includes(']')) {
                            const resolvedIdx = resolveNestedIndex(idx);
                            expr = `get(mem, ${expr}, ${resolvedIdx})`;
                        } else {
                            expr = `get(mem, ${expr}, ${idx})`;
                        }
                    }
                    result += expr;
                    i = k;
                }
            } else {
                // Sem indexação, copia o identificador
                result += base;
                i = j;
            }
        }
        
        src = result;
        if (src === originalSrc) {
            changed = false;
        }
    }
    
    return src;
}

// === CONVERSÃO DE OPERADORES MATEMÁTICOS (INFINITOS) ===
function convertMathOperators(src) {
    let changed = true;
    let iterations = 0;
    
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        const original = src;
        // @ é parte do identificador desde o início
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*\*\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*\*\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'mul($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*\/\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*\/\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'div($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*%\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*%\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'mod($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*\+\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*\+\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'add($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*-\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*-\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'sub($1, $2)');
        });
        if (src === original) {
            changed = false;
        }
    }
    return src;
}

// === CONVERSÃO DE OPERADORES RELACIONAIS ===
function convertComparisonOperators(src) {
    let changed = true;
    let iterations = 0;
    
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        const original = src;
        // @ é parte do identificador desde o início
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*==\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*==\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'eq($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*!=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*!=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'neq($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*<=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*<=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'le($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*>=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*>=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'ge($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*<\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*<\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'lt($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*>\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*>\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'gt($1, $2)');
        });
        if (src === original) {
            changed = false;
        }
    }
    return src;
}

// === CONVERSÃO DE OPERADORES LÓGICOS ===
function convertLogicalOperators(src) {
    let changed = true;
    let iterations = 0;
    
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        const original = src;
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*&&\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*&&\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'and($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*\|\|\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*\|\|\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'or($1, $2)');
        });
        src = src.replace(/!\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/!\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'not($1)');
        });
        if (src === original) {
            changed = false;
        }
    }
    return src;
}

// === CONVERSÃO DE OPERADORES BITWISE ===
function convertBitwiseOperators(src) {
    let changed = true;
    let iterations = 0;
    
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        const original = src;
        // @ é parte do identificador desde o início
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*&\s*(?!&)(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*&\s*(?!&)(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'band($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*\|\s*(?!\|)(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*\|\s*(?!\|)(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'bor($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*\^\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*\^\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'bxor($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*<<\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*<<\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'lshift($1, $2)');
        });
        src = src.replace(/(@?[A-Za-z0-9_)]+)\s*>>\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z0-9_)]+)\s*>>\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'lshift($1, $2)');
        });
        src = src.replace(/~\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/~\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'bnot($1)');
        });
        if (src === original) {
            changed = false;
        }
    }
    return src;
}

// === CONVERSÃO DO OPERADOR DE DEFINIÇÃO ===
function convertAssignment(src) {
    let changed = true;
    let iterations = 0;
    
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        const original = src;
        // @ é parte do identificador desde o início
        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*\+=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*\+=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'set(mem, $1, add($1, $2))');
        });
        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*-=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*-=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'set(mem, $1, sub($1, $2))');
        });
        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*\*=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*\*=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'set(mem, $1, mul($1, $2))');
        });
        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*\/=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*\/=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'set(mem, $1, div($1, $2))');
        });
        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*%=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*%=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'set(mem, $1, mod($1, $2))');
        });
        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*&=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*&=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'set(mem, $1, band($1, $2))');
        });
        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*\|=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*\|=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'set(mem, $1, bor($1, $2))');
        });
        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*\^=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*\^=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'set(mem, $1, bxor($1, $2))');
        });
        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*<<=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*<<=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'set(mem, $1, lshift($1, $2))');
        });
        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*>>=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*>>=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'set(mem, $1, rshift($1, $2))');
        });
        // @ é parte do identificador desde o início
        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*=\s*(?!=)(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g, (match) => {
            changed = true;
            return match.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*=\s*(?!=)(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/, 'set(mem, $1, $2)');
        });
        if (src === original) {
            changed = false;
        }
    }
    return src;
}

// === REORDENAÇÃO DE CHAMADAS ===
function reorderFunctionCalls(src, macros) {
    const forbidden = { ...macros, 'private': true, 'public': true, 'protected': true };
    let changed = true;
    let iterations = 0;
    
    
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        const originalSrc = src;
        
        // Encontra a função mais interna primeiro (sem outras funções dentro dos argumentos)
        // Isso evita tentar reordenar antes de todas as subfunções serem reordenadas
        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*\(\s*([^()]*)\s*\)/g, (match, name, argsRaw) => {
            if (forbidden[name]) {
                return match;
            }
            changed = true;
            const args = argsRaw.split(',').map(a => a.trim());
            args.reverse();
            args.push(name);
            return args.join(' ');
        });
        
        if (src === originalSrc) {
            changed = false;
        }
    }
    
    return src;
}

// === PROCESSAMENTO DE BLOCOS PUBLIC/PRIVATE/PROTECTED ===
function process(s) {
    let out = '';
    let i = 0;
    let protected_defs = [];
    while (i < s.length) {
        const remaining = s.substring(i);
        const match = remaining.match(/^(.*?)\b(public|private|protected)\b/s);
        if (match) {
            const before = match[1];
            const kw = match[2];
            out += before;
            i += match[0].length;
            const nameMatch = s.substring(i).match(/^\s*(@?[A-Za-z_][@A-Za-z0-9_]*)\s*/);
            if (nameMatch) {
                const name = nameMatch[1];
                i += nameMatch[0].length;
                const blockMatch = s.substring(i).match(/^\s*\{/);
                if (blockMatch) {
                    i += blockMatch[0].length;
                    const openPos = i - 1;
                    const [inner, posAfter] = extractBlock(s, openPos, '{', '}');
                    i = posAfter;
                    const proc = process(inner);
                    if (kw === 'public') {
                        out += `${name}:
${proc}
${name}_end:`;
                    } else if (kw === 'protected') {
                        protected_defs.push(`${name}_end goto
${name}:
${proc}
${name}_end:`);
                    } else if (kw === 'private') {
                        out += `${name}_end goto
${name}:
${proc}
${name}_end:`;
                    }
                } else {
                    out += `${kw} ${name}`;
                }
            } else {
                out += kw;
            }
        } else {
            out += s.substring(i);
            break;
        }
    }
    if (protected_defs.length > 0) {
        out = protected_defs.join('\n') + '\n' + out;
    }
    return out;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*<<=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g');
}

// === FUNÇÃO PÚBLICA PRINCIPAL ===
function preprocessCode(input) {
    let src = input;
    src = removeComments(src);
    const [macros, srcAfterMacros] = collectMacros(src);
    src = srcAfterMacros;
    src = expandMacros(src, macros);
    src = convertDoubleQuoteStrings(src);
    // Novos processamentos de operadores (ordem importa)
    src = convertIndexation(src);  // Indexação primeiro (gera get/set com parênteses)
    src = convertMathOperators(src);  // Matemática (infinita)
    src = convertComparisonOperators(src);  // Comparação (infinita)
    src = convertBitwiseOperators(src);  // Bitwise (infinita)
    src = convertLogicalOperators(src);  // Lógica (infinita)
    src = convertAssignment(src);  // Atribuição (infinita)
    src = reorderFunctionCalls(src, macros);  // Converte func(a, b) para b a func
    src = process(src);  // Processa blocos public/private/protected
    return src;
}
// Export para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
    // Node.js / CommonJS
    module.exports = { preprocessCode };
} else if (typeof exports !== 'undefined') {
    // Browser / QuickJS
    exports.preprocessCode = preprocessCode;
}