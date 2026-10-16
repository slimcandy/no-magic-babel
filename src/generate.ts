import type { AnyNode, Expression, Literal } from "acorn";

/**
 * Step 3: tree → text.
 *
 * The printer walks the tree once more and writes a few characters for
 * each node. Every node type needs its own lines here. A type that's
 * missing stops the printer: nothing is skipped or guessed.
 */
export function generate(ast: AnyNode, onWrite?: (text: string, node: AnyNode) => void): string {
  let code = "";
  let indent = "";
  let current = ast;

  const write = (text: string) => {
    code += text;
    onWrite?.(text, current);
  };

  const print = (node: AnyNode | null | undefined) => {
    if (!node) return;
    const printer = printers[node.type] as ((node: AnyNode) => void) | undefined;
    if (!printer) throw new Error(`I don't know how to print a ${node.type}`);

    const parent = current;
    current = node;
    printer(node);
    current = parent;
  };

  const list = (nodes: AnyNode[]) =>
    nodes.forEach((node, index) => {
      if (index > 0) write(", ");
      print(node);
    });

  const statements = (nodes: AnyNode[]) =>
    nodes.forEach((node) => {
      write("\n" + indent);
      print(node);
    });

  // `(a + b) * c` needs its brackets: the tree knows the order, the text doesn't.
  const operand = (node: Expression, parentOperator: string, right = false) => {
    const inner = node.type === "BinaryExpression" ? precedence[node.operator] : node.type === "AssignmentExpression" || node.type === "ArrowFunctionExpression" ? 0 : Infinity;
    const outer = precedence[parentOperator] ?? 0;
    const brackets = inner < outer || (right && inner === outer);
    if (brackets) write("(");
    print(node);
    if (brackets) write(")");
  };

  const printers: { [T in AnyNode["type"]]?: (node: Extract<AnyNode, { type: T }>) => void } = {
    Program(node) {
      node.body.forEach((statement, index) => {
        if (index > 0) write("\n");
        print(statement);
      });
      write("\n");
    },
    ExpressionStatement(node) {
      print(node.expression);
      write(";");
    },
    VariableDeclaration(node) {
      write(node.kind + " ");
      list(node.declarations);
      write(";");
    },
    VariableDeclarator(node) {
      print(node.id);
      if (node.init) {
        write(" = ");
        print(node.init);
      }
    },
    FunctionDeclaration(node) {
      write("function ");
      print(node.id);
      write("(");
      list(node.params);
      write(") ");
      print(node.body);
    },
    FunctionExpression(node) {
      write("function ");
      print(node.id);
      write("(");
      list(node.params);
      write(") ");
      print(node.body);
    },
    ArrowFunctionExpression(node) {
      write("(");
      list(node.params);
      write(") => ");
      print(node.body);
    },
    BlockStatement(node) {
      write("{");
      const outer = indent;
      indent += "  ";
      statements(node.body);
      indent = outer;
      write(node.body.length > 0 ? "\n" + indent + "}" : "}");
    },
    ReturnStatement(node) {
      write("return");
      if (node.argument) {
        write(" ");
        print(node.argument);
      }
      write(";");
    },
    BinaryExpression(node) {
      operand(node.left as Expression, node.operator);
      write(` ${node.operator} `);
      operand(node.right, node.operator, true);
    },
    AssignmentExpression(node) {
      print(node.left);
      write(` ${node.operator} `);
      print(node.right);
    },
    MemberExpression(node) {
      print(node.object);
      if (node.computed) {
        write("[");
        print(node.property);
        write("]");
      } else {
        write(".");
        print(node.property);
      }
    },
    CallExpression(node) {
      const wrap = node.callee.type === "FunctionExpression" || node.callee.type === "ArrowFunctionExpression";
      if (wrap) write("(");
      print(node.callee);
      if (wrap) write(")");
      write("(");
      list(node.arguments);
      write(")");
    },
    NewExpression(node) {
      write("new ");
      print(node.callee);
      write("(");
      list(node.arguments);
      write(")");
    },
    Identifier(node) {
      write(node.name);
    },
    Literal(node: Literal) {
      write(typeof node.value === "string" ? JSON.stringify(node.value) : (node.raw ?? String(node.value)));
    },
    ThisExpression() {
      write("this");
    },
  };

  print(ast);
  return code;
}

const precedence: Record<string, number> = {
  "|": 3, "^": 4, "&": 5,
  "==": 6, "!=": 6, "===": 6, "!==": 6,
  "<": 7, ">": 7, "<=": 7, ">=": 7, in: 7, instanceof: 7,
  "<<": 8, ">>": 8, ">>>": 8,
  "+": 9, "-": 9, "*": 10, "/": 10, "%": 10, "**": 11,
};
