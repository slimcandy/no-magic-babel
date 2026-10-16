// Runs the real compiler once and records every moment of it as a frame.
// The page then shows frame after frame as you scroll.
import type { AnyNode } from "acorn";
import { parse } from "../src/parse.ts";
import { childKeys, traverse, type Rule } from "../src/traverse.ts";
import { generate } from "../src/generate.ts";

export type ViewNode = {
  id: number;
  type: string;
  label: string;
  /** The field of the parent that holds this node: `init`, `body` … */
  key: string;
  start: number;
  end: number;
  children: ViewNode[];
};

export type Frame = {
  tree: ViewNode | null;
  /** While parsing: how many nodes acorn has made so far. */
  shown: number;
  /** The node the walker stands on. */
  at: number | null;
  /** The node a rule just changed. */
  changed: number | null;
  verb: "text" | "make" | "enter" | "leave" | "rule" | "write" | "done";
  say: string;
  output: string;
  last: string;
};

export function record(code: string, rules: Rule[]) {
  const ids = new Map<AnyNode, number>();
  const id = (node: AnyNode) => ids.get(node) ?? ids.set(node, ids.size + 1).get(node)!;

  const view = (node: AnyNode, key = ""): ViewNode => ({
    id: id(node),
    type: node.type,
    label: label(node),
    key,
    start: node.start,
    end: node.end,
    children: (childKeys[node.type] ?? []).flatMap((childKey) => {
      const value = (node as unknown as Record<string, AnyNode | AnyNode[] | null>)[childKey];
      const list = Array.isArray(value) ? value : value ? [value] : [];
      return list.map((child) => view(child, childKey));
    }),
  });

  const frames: Frame[] = [];
  const base: Frame = { tree: null, shown: 0, at: null, changed: null, verb: "text", say: "Just text. Nothing knows what it means yet.", output: "", last: "" };
  const push = (frame: Partial<Frame>) => frames.push({ ...(frames.at(-1) ?? base), changed: null, last: "", ...frame });
  push({});

  // 1. Parse: acorn makes the nodes. Show them one by one, top to bottom.
  const ast = parse(code);
  const tree = view(ast);
  const order: ViewNode[] = [];
  (function walk(node: ViewNode) {
    order.push(node);
    node.children.forEach(walk);
  })(tree);
  order.forEach((node, index) => push({ tree, shown: index + 1, at: node.id, verb: "make", say: `acorn makes ${/^[AEIOU]/.test(node.type) ? "an" : "a"} ${node.type}` }));
  const parsed = frames.length - 1;

  // 2. Traverse: the walker enters and leaves every node, and the rules edit some.
  const ruleFor = (type: string) => rules.filter((rule) => type in rule.visitor).map((rule) => rule.name);
  traverse(ast, rules, {
    enter(node) {
      const wanted = ruleFor(node.type);
      push({ tree: view(ast), shown: Infinity, at: id(node), verb: "enter", say: `${node.type}${wanted.length ? `: the rule “${wanted.join("”, “")}” wants this type` : ""}` });
    },
    step(rule, what, node) {
      push({ tree: view(ast), at: id(node), changed: id(node), verb: "rule", say: `${rule.name}: ${what}` });
    },
    exit(node) {
      push({ tree: view(ast), at: id(node), verb: "leave", say: node.type });
    },
  });
  const walked = frames.length - 1;

  // 3. Generate: the printer walks again and writes text for each node.
  const edited = view(ast);
  let output = "";
  generate(ast, (text, node) => {
    output += text;
    push({ tree: edited, at: id(node), verb: "write", say: `${node.type} writes ${JSON.stringify(text)}`, output, last: text });
  });
  push({ at: null, verb: "done", say: "Done. Same code in, same code out, every time.", last: "" });

  return { frames, parsed, walked, ast };
}

function label(node: AnyNode): string {
  switch (node.type) {
    case "VariableDeclaration":
      return node.kind;
    case "VariableDeclarator":
      return "=";
    case "Identifier":
      return node.name;
    case "Literal":
      return typeof node.value === "string" ? JSON.stringify(node.value) : String(node.raw);
    case "BinaryExpression":
      return node.operator;
    case "ArrowFunctionExpression":
      return "=>";
    case "FunctionExpression":
      return "function";
    case "BlockStatement":
      return "{ }";
    case "ReturnStatement":
      return "return";
    default:
      return "";
  }
}

/** A node as the plain object it is, one level deep. */
export function plain(node: AnyNode): string {
  const lines = Object.entries(node)
    .filter(([key]) => key !== "start" && key !== "end")
    .map(([key, value]) =>
      Array.isArray(value) && value.length > 0 ? `  ${key}: [\n${value.map((item) => `    ${short(item)},`).join("\n")}\n  ],` : `  ${key}: ${short(value)},`,
    );
  return `{\n${lines.join("\n")}\n}`;
}

function short(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(short).join(", ")}]`;
  if (value && typeof value === "object" && "type" in value) return `{ type: "${value.type}", … }`;
  return JSON.stringify(value);
}
