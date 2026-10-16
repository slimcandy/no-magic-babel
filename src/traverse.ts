import type { AnyNode } from "acorn";

/**
 * Step 2: walk the tree and let the rules edit it.
 *
 * The walker doesn't know what any node means. It only knows where each
 * kind of node keeps its children, from this list. A node type that isn't
 * in the list stops the walk.
 */
export const childKeys: Record<string, string[]> = {
  Program: ["body"],
  ExpressionStatement: ["expression"],
  VariableDeclaration: ["declarations"],
  VariableDeclarator: ["id", "init"],
  FunctionDeclaration: ["id", "params", "body"],
  FunctionExpression: ["id", "params", "body"],
  ArrowFunctionExpression: ["params", "body"],
  BlockStatement: ["body"],
  ReturnStatement: ["argument"],
  BinaryExpression: ["left", "right"],
  AssignmentExpression: ["left", "right"],
  MemberExpression: ["object", "property"],
  CallExpression: ["callee", "arguments"],
  NewExpression: ["callee", "arguments"],
  Identifier: [],
  Literal: [],
  ThisExpression: [],
};

export type Context = {
  /** The nodes above this one: Program first, the parent last. */
  ancestors: AnyNode[];
  /** Do one step of a rule. Each step is one small, named change. */
  step(what: string, change: () => void): void;
};

type Visitor = {
  [T in AnyNode["type"]]?: (node: Extract<AnyNode, { type: T }>, context: Context) => void;
};

/** A rule says which node type it wants and what to change. Babel calls it a plugin. */
export type Rule = {
  name: string;
  visitor: Visitor;
};

/** Lets the page watch the walk. The compiler works without them. */
export type Hooks = {
  enter?(node: AnyNode): void;
  exit?(node: AnyNode): void;
  step?(rule: Rule, what: string, node: AnyNode): void;
};

export function children(node: AnyNode): AnyNode[] {
  const keys = childKeys[node.type];
  if (!keys) throw new Error(`I don't know where a ${node.type} keeps its children`);

  const fields = node as unknown as Record<string, AnyNode | AnyNode[] | null>;
  return keys.flatMap((key) => fields[key] ?? []);
}

export function traverse(ast: AnyNode, rules: Rule[], hooks: Hooks = {}): void {
  const ancestors: AnyNode[] = [];

  function visit(node: AnyNode) {
    hooks.enter?.(node);

    for (const rule of rules) {
      const visitor = rule.visitor[node.type] as ((node: AnyNode, context: Context) => void) | undefined;
      visitor?.(node, {
        ancestors,
        step(what, change) {
          change();
          hooks.step?.(rule, what, node);
        },
      });
    }

    // Read the children after the rules ran: a rule may have changed them.
    ancestors.push(node);
    for (const child of children(node)) visit(child);
    ancestors.pop();

    hooks.exit?.(node);
  }

  visit(ast);
}
