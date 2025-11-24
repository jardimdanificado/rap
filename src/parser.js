// ============================================
// CORE PREPROCESSOR - Motor de Processamento
// ============================================
// Com suporte a operadores matemáticos, condicionais, definição, indexação e PATTERNS

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
// ============================================
// SISTEMA GLOBAL DE CONTADOR
// ============================================
const counterState = {
    value: 0,
    reset: function() {
        this.value = 0;
    }
};

// ============================================
// VERSÃO CORRIGIDA DE PATTERN MATCHING + CONTADOR
// ============================================
// Nova versão de patternToRegex com suporte a blocos balanceados
function patternToRegex(pattern) {
    let regex = '';
    let i = 0;
    let varCounter = 0;

    while (i < pattern.length) {
        // Verifica por $$
        if (i + 1 < pattern.length && pattern[i] === '$' && pattern[i + 1] === '$') {
            // $$ agora pode aparecer entre caracteres (não apenas espaços)
            // Vamos substituir por \s* (espaço opcional), mas não consome caracteres reais
            regex += '\\s*';
            i += 2;
            continue;
        }

        // Verifica por delimitadores com variáveis: {$var}, ($var), [$var]
        if ((pattern[i] === '{' || pattern[i] === '(' || pattern[i] === '[') &&
            i + 1 < pattern.length && pattern[i + 1] === '$') {

            const openDelim = pattern[i];
            const closeDelim = openDelim === '{' ? '}' : (openDelim === '(' ? ')' : ']');

            // Captura nome da variável
            let j = i + 2; // pula o delimitador e o $
            while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) {
                j++;
            }

            // Verifica se fecha com o delimitador correto
            if (j < pattern.length && pattern[j] === closeDelim) {
                const escapedOpen = openDelim === '(' ? '\\(' : (openDelim === '[' ? '\\[' : openDelim === '{' ? '\\{' : openDelim);
                const escapedClose = closeDelim === ')' ? '\\)' : (closeDelim === ']' ? '\\]' : closeDelim === '}' ? '\\}' : closeDelim);

                // Usa a função auxiliar para capturar blocos balanceados
                const innerRegex = buildBalancedBlockRegex(openDelim, closeDelim);

                regex += escapedOpen + '(' + innerRegex + ')' + escapedClose;
                varCounter++;
                i = j + 1;
                continue;
            }
        }

        if (pattern[i] === '$') {
            // Captura nome da variável (simples, sem delimitadores)
            let j = i + 1;
            let varName = '';
            while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) {
                varName += pattern[j];
                j++;
            }
            if (varName) {
                // Grupo de captura que pega qualquer coisa não-whitespace
                regex += '(\\S+)';
                varCounter++;
                i = j;
            } else {
                // Apenas $ (solto)
                regex += '\\$';
                i++;
            }
        } else if (/\s/.test(pattern[i])) {
            // Qualquer whitespace vira \s+
            regex += '\\s+';
            // Pula todos os espaços consecutivos no pattern
            while (i < pattern.length && /\s/.test(pattern[i])) {
                i++;
            }
        } else {
            // Caractere literal (escapa se necessário)
            const char = pattern[i];
            if (/[.*+?^${}()|[\]\\]/.test(char)) {
                regex += '\\' + char;
            } else {
                regex += char;
            }
            i++;
        }
    }

    return new RegExp(regex, 'g');
}

// Função auxiliar para gerar regex que captura blocos balanceados
function buildBalancedBlockRegex(open, close) {
    const escapedOpen = open === '(' ? '\\(' : (open === '[' ? '\\[' : open === '{' ? '\\{' : open);
    const escapedClose = close === ')' ? '\\)' : (close === ']' ? '\\]' : close === '}' ? '\\}' : close);

    // Regex para capturar blocos balanceados
    // Ex: {a{b}c} -> captura a{b}c
    return `(?:[^${escapedOpen}${escapedClose}\\\\]|\\\\.|${escapedOpen}(?:[^${escapedOpen}${escapedClose}\\\\]|\\\\.)*${escapedClose})*`;
}

// Versão corrigida de extractVarNames
function extractVarNames(pattern) {
    const vars = [];
    const seen = new Set();
    let i = 0;
    
    while (i < pattern.length) {
        // Verifica por $$
        if (i + 1 < pattern.length && pattern[i] === '$' && pattern[i + 1] === '$') {
            i += 2;
            continue;
        }
        
        // Verifica por delimitadores com variáveis
        if ((pattern[i] === '{' || pattern[i] === '(' || pattern[i] === '[') && 
            i + 1 < pattern.length && pattern[i + 1] === '$') {
            
            const closeDelim = pattern[i] === '{' ? '}' : (pattern[i] === '(' ? ')' : ']');
            let j = i + 2;
            
            while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) {
                j++;
            }
            
            if (j < pattern.length && pattern[j] === closeDelim) {
                const varName = pattern.substring(i + 2, j);
                if (!seen.has(varName)) {
                    vars.push('$' + varName);
                    seen.add(varName);
                }
                i = j + 1;
                continue;
            }
        }
        
        if (pattern[i] === '$') {
            let j = i + 1;
            while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) {
                j++;
            }
            const varName = pattern.substring(i + 1, j);
            if (!seen.has(varName)) {
                vars.push('$' + varName);
                seen.add(varName);
            }
            i = j;
        } else {
            i++;
        }
    }
    
    return vars;
}

// Processa operadores de contador ($counter, $counter++, $counter--)
function processCounterOperators(str) {
    // $counter++ -> incrementa
    str = str.replace(/\$counter\+\+/g, () => {
        counterState.value++;
        return "";
    });
    
    // $counter-- -> decrementa
    str = str.replace(/\$counter--/g, () => {
        counterState.value--;
        return "";
    });
    
    // $counter -> retorna valor atual (sem modificar)
    str = str.replace(/\$counter(?!\+|-)/g, () => {
        return counterState.value.toString();
    });
    
    return str;
}

// ============================================
// INTEGRAÇÕES PRINCIPAIS
// ============================================

// === COLETA DE MACROS (MODIFICADA) ===
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
        // Processa contadores no corpo do macro
        macros[m.name] = processCounterOperators(body);
        src = src.substring(0, m.matchStart) + src.substring(posAfter);
    }
    return [macros, src];
}

// === COLETA DE PATTERNS (MODIFICADA) ===
function collectPatterns(src) {
    const patterns = [];
    const patternRegex = /\bpattern\s*\{/g;
    let match;
    const matches = [];
    
    while ((match = patternRegex.exec(src)) !== null) {
        matches.push({
            matchStart: match.index,
            openPos: match.index + match[0].length - 1
        });
    }
    
    for (let j = matches.length - 1; j >= 0; j--) {
        const m = matches[j];
        const [matchPattern, posAfterMatch] = extractBlock(src, m.openPos, '{', '}');
        
        let k = posAfterMatch;
        while (k < src.length && /\s/.test(src[k])) k++;
        
        if (k < src.length && src[k] === '{') {
            const [replacePattern, posAfterReplace] = extractBlock(src, k, '{', '}');
            patterns.push({
                match: matchPattern.trim(),
                // Processa contadores no padrão de replacement
                replace: processCounterOperators(replacePattern.trim())
            });
            src = src.substring(0, m.matchStart) + src.substring(posAfterReplace);
        }
    }
    
    return [patterns, src];
}

function applyPatterns(src, patterns) {
    for (const pattern of patterns) {
        let changed = true;
        let iterations = 0;

        while (changed && iterations < 512) {
            changed = false;
            iterations++;

            const regex = patternToRegex(pattern.match);
            const varNames = extractVarNames(pattern.match);

            src = src.replace(regex, (...args) => {
                changed = true;
                const match = args[0];
                const captures = args.slice(1, -2);

                const varMap = {};
                for (let i = 0; i < varNames.length; i++) {
                    varMap[varNames[i]] = captures[i] || '';
                }

                let result = pattern.replace;

                // Substitui as variáveis capturadas, **antes** de processar $$
                for (const [varName, value] of Object.entries(varMap)) {
                    // Escapa o nome da variável para evitar conflitos com regex
                    const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // Substitui $varname, garantindo que não seja seguido por um caractere alfanumérico ou _
                    result = result.replace(new RegExp(escapedVarName + '(?![A-Za-z0-9_])', 'g'), value);
                }

                // Processa contadores no resultado da substituição
                result = processCounterOperators(result);

                // Agora sim, remove os $$ para permitir concatenação
                result = result.replace(/\$\$/g, '');

                return result;
            });
        }
    }

    return src;
}

// === EXPANSÃO DE MACROS (MODIFICADA) ===
function expandMacros(src, macros) {
    for (const name of Object.keys(macros)) {
        const body = macros[name];
        let changed = true;
        let iterations = 0;
        
        while (changed && iterations < 512) {
            changed = false;
            iterations++;
            const originalSrc = src;
            
            let i = 0;
            let result = '';
            
            while (i < src.length) {
                const remaining = src.substring(i);
                const nameMatch = remaining.match(new RegExp(`^(.*?)\\b${escapeRegex(name)}\\b`, 's'));
                
                if (!nameMatch) {
                    result += remaining;
                    break;
                }
                
                result += nameMatch[1];
                i += nameMatch[0].length;
                
                let k = i;
                while (k < src.length && src[k] === ' ') k++;
                
                let vals = [];
                
                if (k < src.length && src[k] === '(') {
                    const [argsStr, posAfter] = extractBlock(src, k, '(', ')');
                    vals = argsStr.split(',').map(v => v.trim());
                    i = posAfter;
                    changed = true;
                } else {
                    const spaceMatch = src.substring(i).match(/^(\s+([^\s{};()]+(?:\s+[^\s{};()]+)*?))?(?=\s*[{};()$]|\n|$)/);
                    if (spaceMatch && spaceMatch[2]) {
                        vals = spaceMatch[2].split(/\s+/);
                        i += spaceMatch[0].length;
                        changed = true;
                    } else {
                        result += name;
                        continue;
                    }
                }
                
                let exp = body;
                exp = exp.replace(/\$0\b/g, name);
                for (let j = 0; j < vals.length; j++) {
                    const paramNum = j + 1;
                    const paramVal = vals[j];
                    exp = exp.replace(new RegExp(`\\$${paramNum}(?!\\d)`, 'g'), paramVal);
                }
                exp = exp.replace(/\$\d+\b/g, '');
                // Processa contadores na expansão do macro
                exp = processCounterOperators(exp);
                result += exp;
            }
            
            src = result;
            
            if (src === originalSrc) {
                changed = false;
            }
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
            defs.push(`goto(${id}_end)\n ${id}: \\${formatted} ${id}_end:`);
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

// === CONVERSÃO DO OPERADOR DE DEFINIÇÃO (CORRIGIDO) ===
function convertAssignment(src) {
    let changed = true;
    let iterations = 0;
    
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        const original = src;
        
        // Processa atribuições compostas primeiro
        const compoundOps = ['+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='];
        const compoundFuncs = ['add', 'sub', 'mul', 'div', 'mod', 'band', 'bor', 'bxor', 'lshift', 'rshift'];
        
        for (let i = 0; i < compoundOps.length; i++) {
            const op = compoundOps[i];
            const func = compoundFuncs[i];
            const escapedOp = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Captura até ponto-e-vírgula, quebra de linha ou fim da linha
            const pattern = new RegExp(
                `(@?[A-Za-z_][@A-Za-z0-9_]*)\\s*${escapedOp}\\s*([^;\\n]+?)(?=;|\\n|$)`,
                'g'
            );
            
            src = src.replace(pattern, (match, varName, exprRaw) => {
                changed = true;
                const expr = exprRaw.trim();
                return `set(mem, ${varName}, ${func}(@${varName}, ${expr}))`;
            });
        }
        
        // Agora processa atribuição simples (=)
        // Captura até ponto-e-vírgula, quebra de linha ou fim da linha
        src = src.replace(
            /(@?[A-Za-z_][@A-Za-z0-9_]*)\s*=\s*(?!=)([^;=\n]+?)(?=;|\n|$)/g,
            (match, varName, exprRaw) => {
                changed = true;
                const expr = exprRaw.trim();
                return `set(mem, ${varName}, ${expr})`;
            }
        );
        
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

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*<<=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g');
}

// === FUNÇÃO PÚBLICA PRINCIPAL ===
function preprocessCode(input) {
    let src = input;
    src = removeComments(src);
    const [macros, srcAfterMacros] = collectMacros(src);
    src = srcAfterMacros;
    const [patterns, srcAfterPatterns] = collectPatterns(src);
    src = srcAfterPatterns;
    src = applyPatterns(src, patterns);  // Aplica patterns antes de expandir macros
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
