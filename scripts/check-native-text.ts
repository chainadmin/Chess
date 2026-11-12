/**
 * Finds JSX that renders a raw string or number outside <Text>. React Native
 * throws "Text strings must be rendered within a <Text> component" for these on
 * iOS/Android (a crash in release builds), while the web renders them fine.
 *
 * Flags:
 *  - literal text directly inside a non-Text element
 *  - {expressions} inside a non-Text element whose type can be a string or number,
 *    including `value && <X/>` where value may be "" or 0
 *
 * Usage: node --import tsx scripts/check-native-text.ts
 */
// TypeScript 7 (the project's tsc) has no JS compiler API, so this check uses TypeScript 5's.
import * as ts from 'typescript-api';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json')!;
const config = ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, root);
const program = ts.createProgram(config.fileNames, config.options);
const checker = program.getTypeChecker();

// Elements whose children are rendered as text.
const TEXT_TAGS = new Set(['Text', 'Animated.Text']);
const problems: string[] = [];

function tagName(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string {
  return node.tagName.getText();
}

function canBeTextish(type: ts.Type): boolean {
  const parts = type.isUnion() ? type.types : [type];
  return parts.some(part => {
    const flags = part.getFlags();
    if (flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike)) return true;
    // string[] / number[] produced by .map(...)
    if (checker.isArrayType(part)) {
      const [element] = checker.getTypeArguments(part as ts.TypeReference);
      return !!element && canBeTextish(element);
    }
    return false;
  });
}

function report(node: ts.Node, message: string) {
  const file = node.getSourceFile();
  const { line, character } = file.getLineAndCharacterOfPosition(node.getStart());
  problems.push(`${path.relative(root, file.fileName)}:${line + 1}:${character + 1} ${message}`);
}

function checkChildren(children: ts.NodeArray<ts.JsxChild>, insideText: boolean, parent: string) {
  for (const child of children) {
    if (ts.isJsxText(child)) {
      if (!insideText && child.getText().trim()) report(child, `raw text "${child.getText().trim().slice(0, 40)}" inside <${parent}>`);
    } else if (ts.isJsxExpression(child)) {
      // `{children}` slots in layout components only ever receive elements from callers.
      const passthrough = child.expression && /^(props\.)?children$/.test(child.expression.getText());
      if (child.expression && !insideText && !passthrough) {
        const type = checker.getTypeAtLocation(child.expression);
        if (canBeTextish(type)) report(child, `{${child.expression.getText().slice(0, 60)}} can render a string/number inside <${parent}> (type: ${checker.typeToString(type).slice(0, 80)})`);
      }
      if (child.expression) visit(child.expression, insideText, parent);
    } else if (ts.isJsxFragment(child)) {
      checkChildren(child.children, insideText, parent);
    } else {
      visit(child, insideText, parent);
    }
  }
}

function visit(node: ts.Node, insideText: boolean, parent: string) {
  if (ts.isJsxElement(node)) {
    const name = tagName(node.openingElement);
    for (const attr of node.openingElement.attributes.properties) visit(attr, false, name);
    checkChildren(node.children, TEXT_TAGS.has(name), name);
    return;
  }
  if (ts.isJsxSelfClosingElement(node)) {
    for (const attr of node.attributes.properties) visit(attr, false, tagName(node));
    return;
  }
  if (ts.isJsxFragment(node)) {
    checkChildren(node.children, insideText, parent);
    return;
  }
  // JSX nested inside expressions (ternaries, &&, .map callbacks, props) starts a new context.
  ts.forEachChild(node, child => visit(child, ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child) ? insideText : insideText, parent));
}

for (const file of program.getSourceFiles()) {
  if (file.isDeclarationFile || !file.fileName.endsWith('.tsx') || file.fileName.includes('node_modules') || file.fileName.includes('__tests__')) continue;
  ts.forEachChild(file, node => visit(node, false, 'root'));
}

if (problems.length) {
  console.error(`Found ${problems.length} place(s) that can crash on iOS/Android:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('No raw strings or numbers outside <Text>.');
