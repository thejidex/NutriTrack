import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

// Web tolerates bare text in divs; React Native throws, so check the actual JSX AST too.
function rawText(source: string, filename: string): string[] {
  const tree = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const issues: string[] = [];
  const textHosts = new Set(['Text', 'Txt', 'SvgText']);
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node)) {
      const host = node.openingElement.tagName.getText(tree);
      if (!textHosts.has(host))
        for (const child of node.children) {
          const bareJsx =
            ts.isJsxText(child) &&
            (child.text.trim().length > 0 || (!/[\r\n]/.test(child.text) && child.text.length > 0));
          const literal =
            ts.isJsxExpression(child) &&
            child.expression &&
            ((ts.isStringLiteral(child.expression) && child.expression.text.length > 0) ||
              ts.isNumericLiteral(child.expression));
          if (bareJsx || literal)
            issues.push(
              `${filename}:${tree.getLineAndCharacterOfPosition(child.getStart(tree)).line + 1} ${host}`,
            );
        }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return issues;
}
test('native text regression guard catches JSX whitespace and literals', () => {
  assert.equal(rawText("<Row><Chip />{' '}<Chip /></Row>", 'fixture.tsx').length, 1);
  assert.equal(rawText('<View>文字</View>', 'fixture.tsx').length, 1);
  assert.equal(rawText('<View>{0}</View>', 'fixture.tsx').length, 1);
  assert.equal(rawText("<Text>文字{' '}{0}</Text>", 'fixture.tsx').length, 0);
});
test('all app screens and shared components keep literal text inside text hosts', () => {
  const issues: string[] = [];
  function scan(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) scan(path);
      else if (path.endsWith('.tsx')) issues.push(...rawText(readFileSync(path, 'utf8'), path));
    }
  }
  for (const dir of ['app', 'components', 'features', 'hooks']) scan(dir);
  assert.deepEqual(issues, []);
});
