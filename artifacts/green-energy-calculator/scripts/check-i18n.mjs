#!/usr/bin/env node
/**
 * Gate H2b: "A new string added anywhere fails the build if it has no Spanish
 * entry."
 *
 * Half of that is the type system: every word goes through `t(key)`, keys come
 * from the Spanish table, and English is typed against Spanish — so a key with
 * no Spanish entry fails `tsc`. This script is the other half: it fails the
 * build on text written straight into the source, which never meets a catalog
 * at all and would ship in English to a Spanish buyer.
 *
 * It parses every .ts/.tsx under src/ with the TypeScript compiler (no regex
 * over source) and reports:
 *
 *   R1  JSX text containing a letter          <h1>Calculation History</h1>
 *   R2  a text attribute given a literal       placeholder="Enter city..."
 *   R3  a literal rendered as a JSX child      {ok ? "saved per year" : x}
 *   R4  a text property given a literal        toast({ title: "Error" })
 *   R5  any multi-word literal anywhere else   return `not within ${n} years`
 *   R6  a UserMessage built from a literal     new UserMessage("Failed")
 *
 * "Text" means it contains a letter. Digits and punctuation ("—", "/", "%")
 * are not language. Exempt, because they are not prose a person reads:
 * class-name strings (className, cn/cva/clsx/twMerge arguments), console
 * output, developer errors (Error and its subclasses other than UserMessage —
 * a toast shows only UserMessage text, see src/i18n/index.ts), and the
 * catalog itself. There is no allowlist of words: a unit like "kWh" goes
 * through the catalog too, because "kWh/m²/day" is English.
 *
 * Known holes, stated rather than implied:
 *   - a SINGLE-word literal outside JSX and outside the R4 property names
 *     (e.g. a chart series written `{ Generation: n }`) is not caught: R5 needs
 *     whitespace to tell prose from identifiers, enum values and paths;
 *   - index.html is not parsed (its lang and title are set in code at runtime).
 */
import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const LETTER = /\p{L}/u;
/** Two words of letters separated by whitespace: prose, not an identifier, path, query or CSS. */
const PROSE = /\p{L}{2,}[,.;:!?»"')]*\s+[«"'(¿¡]*\p{L}{2,}/u;

const TEXT_ATTRS = new Set([
  "placeholder",
  "title",
  "alt",
  "aria-label",
  "aria-description",
  "aria-valuetext",
  "aria-roledescription",
  "label",
]);
const TEXT_PROPS = new Set(["title", "description", "label", "message", "placeholder", "name"]);
const CLASS_CALLS = new Set(["cn", "cva", "clsx", "twMerge"]);
const CLASS_ATTRS = new Set(["className", "class", "classNames"]);
const CLASS_PROPS = new Set(["className", "classNames", "__html"]);

function literalText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join("");
  }
  return null;
}

function calleeName(call) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) {
    const obj = e.expression;
    return ts.isIdentifier(obj) ? `${obj.text}.${e.name.text}` : e.name.text;
  }
  return null;
}

const COMPARISON = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/** `status === "used"`: an enum value being tested, not rendered. */
function isComparedValue(node) {
  const p = node.parent;
  return (ts.isBinaryExpression(p) && COMPARISON.has(p.operatorToken.kind)) || ts.isCaseClause(p);
}

/** True if `node` sits somewhere a literal is not prose a person reads. */
function isExempt(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const name = calleeName(p);
      if (name && (CLASS_CALLS.has(name) || name.startsWith("console.") || /(^|\.)matchMedia$/.test(name))) return true;
    }
    if (ts.isNewExpression(p) && ts.isIdentifier(p.expression)) {
      const ctor = p.expression.text;
      if (ctor !== "UserMessage" && /Error$/.test(ctor)) return true;
    }
    if (ts.isJsxAttribute(p) && CLASS_ATTRS.has(p.name.getText())) return true;
    // Inline style objects (style, contentStyle, wrapperStyle...): CSS values, not prose.
    if (ts.isJsxAttribute(p) && /style$/i.test(p.name.getText())) return true;
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && /style$/i.test(p.name.text)) return true;
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && CLASS_PROPS.has(p.name.text)) return true;
    // super(...) inside a developer-error class.
    if (ts.isCallExpression(p) && p.expression.kind === ts.SyntaxKind.SuperKeyword) {
      for (let c = p.parent; c; c = c.parent) {
        if (ts.isClassDeclaration(c) || ts.isClassExpression(c)) {
          const n = c.name?.text ?? "";
          if (n !== "UserMessage" && /Error$/.test(n)) return true;
          break;
        }
      }
    }
    // Directive prologue: "use client".
    if (ts.isExpressionStatement(p) && ts.isStringLiteral(p.expression) && p.expression === node) return true;
    // Type positions: string literal types are not rendered.
    if (ts.isLiteralTypeNode(p)) return true;
    // Import/export specifiers.
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    if (ts.isSourceFile(p)) break;
  }
  return false;
}

/**
 * Find untranslated text in one file. Returns [{ rule, line, text }].
 * `keys`: the catalog's keys. A literal that IS a key is a reference to the
 * catalog (`{ label: "nav.history" }` later passed to `t`), not text; `tsc`
 * checks it names a real entry wherever it reaches `t`.
 */
export function findUntranslated(source, fileName = "file.tsx", keys = new Set()) {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const found = [];
  const reported = new Set();

  const report = (rule, node, text) => {
    if (keys.has(text)) return;
    if (reported.has(node.pos)) return;
    reported.add(node.pos);
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    found.push({ rule, line: line + 1, text: text.trim().replace(/\s+/g, " ").slice(0, 80) });
  };

  const visit = (node) => {
    // R1
    if (ts.isJsxText(node) && LETTER.test(node.text)) {
      report("R1", node, node.text);
    }

    // R2 / R3 (attribute)
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      if (TEXT_ATTRS.has(name)) {
        const init = node.initializer;
        const lit = ts.isJsxExpression(init) && init.expression ? literalText(init.expression) : literalText(init);
        if (lit !== null && LETTER.test(lit)) report("R2", node, lit);
      }
    }

    // R3 (child): a literal anywhere inside a JSX child expression, unless it
    // is an argument to a call (t("key"), cn(...), fmt(...)).
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      const walk = (n) => {
        if (ts.isCallExpression(n) || ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return;
        const lit = literalText(n);
        if (lit !== null) {
          if (LETTER.test(lit) && !isExempt(n) && !isComparedValue(n)) report("R3", n, lit);
          return;
        }
        ts.forEachChild(n, walk);
      };
      walk(node.expression);
    }

    // R4
    if (ts.isPropertyAssignment(node)) {
      const key = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
      const lit = literalText(node.initializer);
      if (key && TEXT_PROPS.has(key) && lit !== null && LETTER.test(lit) && !isExempt(node.initializer)) {
        report("R4", node.initializer, lit);
      }
    }

    // R6
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "UserMessage") {
      const arg = node.arguments?.[0];
      const lit = arg ? literalText(arg) : null;
      if (lit !== null && LETTER.test(lit)) report("R6", arg, lit);
    }

    // R5: multi-word prose anywhere else.
    const lit = literalText(node);
    if (
      lit !== null &&
      !isComparedValue(node) &&
      !ts.isJsxText(node) &&
      PROSE.test(lit) &&
      // An attribute value is R2's to report (text attributes) or not prose (the rest).
      !ts.isJsxAttribute(node.parent) &&
      !(ts.isJsxExpression(node.parent) && ts.isJsxAttribute(node.parent.parent)) &&
      !isExempt(node)
    ) {
      report("R5", node, lit);
    }

    // Template spans are reported as one literal above; don't descend into them.
    if (ts.isTemplateExpression(node)) {
      node.templateSpans.forEach((s) => visit(s.expression));
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return found;
}

function listSources(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listSources(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !entry.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

/** The catalog is where the words live; it is the one file allowed to hold them. */
const CATALOG = `i18n${sep}catalog.ts`;

/** The Spanish table's keys: the first object literal passed to defineCatalog. */
export function catalogKeys(source) {
  const sf = ts.createSourceFile("catalog.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const keys = new Set();
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "defineCatalog") {
      const es = node.arguments[0];
      if (es && ts.isObjectLiteralExpression(es)) {
        for (const prop of es.properties) {
          if (ts.isPropertyAssignment(prop) && (ts.isStringLiteral(prop.name) || ts.isIdentifier(prop.name))) {
            keys.add(prop.name.text);
          }
        }
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (keys.size === 0) throw new Error("check-i18n: found no defineCatalog(...) Spanish table in the catalog");
  return keys;
}

export function checkTree(srcDir) {
  const keys = catalogKeys(readFileSync(join(srcDir, CATALOG), "utf8"));
  const problems = [];
  for (const file of listSources(srcDir)) {
    const rel = relative(srcDir, file);
    if (rel === CATALOG) continue;
    for (const p of findUntranslated(readFileSync(file, "utf8"), file, keys)) problems.push({ file: rel, ...p });
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const srcDir = join(fileURLToPath(new URL("..", import.meta.url)), "src");
  const problems = checkTree(srcDir);
  if (problems.length > 0) {
    console.error(`check-i18n: ${problems.length} string(s) written outside the catalog (Gate H2b).`);
    console.error("Put each in src/i18n/catalog.ts — Spanish first — and render it with t(key).\n");
    for (const p of problems) console.error(`  ${p.rule}  src/${p.file}:${p.line}  ${JSON.stringify(p.text)}`);
    process.exit(1);
  }
  console.log("check-i18n: clean — every string in src/ goes through the catalog.");
}
