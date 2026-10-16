import type { AnyNode, Statement, ThisExpression, Identifier } from "acorn";
import { children, type Rule } from "../traverse.ts";
import { toFunction } from "./arrow-functions.ts";

/**
 * The arrow rule again, with two more steps first.
 *
 * An arrow function has no `this` of its own: it uses the `this` of the
 * function around it. A `function` gets a new `this`. So before the
 * rewrite, save the outer `this` in a variable and use that instead.
 * Babel does exactly this (look for `_this` in its output).
 *
 * Still not everything: `arguments`, `super` and `new.target` behave like
 * `this` and each needs its own steps. Babel has them; this rule doesn't.
 */
const saved = new WeakSet<AnyNode>();

export const arrowFunctionsThis: Rule = {
  name: "arrow → function, keeping this",
  visitor: {
    ArrowFunctionExpression(arrow, { ancestors, step }) {
      const uses = findThis(arrow.body);

      if (uses.length > 0) {
        // The closest function that isn't an arrow, or the whole program.
        const outer = ancestors.findLast((node) => node.type === "FunctionDeclaration" || node.type === "FunctionExpression") ?? ancestors[0];
        const body = (outer.type === "Program" ? outer.body : (outer as { body: { body: Statement[] } }).body.body) as Statement[];

        if (!saved.has(outer)) {
          step("Add var _this = this; to the function around it", () => {
            body.unshift(saveThis(arrow.start, arrow.end));
            saved.add(outer);
          });
        }

        step("Replace this with _this", () => {
          for (const use of uses) Object.assign(use, { type: "Identifier", name: "_this" } satisfies Partial<Identifier>);
        });
      }

      toFunction(arrow, step);
    },
  },
};

/** Every `this` that belongs to the outer function: not inside a `function`. */
function findThis(node: AnyNode): ThisExpression[] {
  if (node.type === "ThisExpression") return [node];
  if (node.type === "FunctionExpression" || node.type === "FunctionDeclaration") return [];
  return children(node).flatMap(findThis);
}

/** `var _this = this;`, pointing at the arrow it was made for. */
function saveThis(start: number, end: number): Statement {
  return {
    type: "VariableDeclaration",
    start,
    end,
    kind: "var",
    declarations: [
      {
        type: "VariableDeclarator",
        start,
        end,
        id: { type: "Identifier", start, end, name: "_this" },
        init: { type: "ThisExpression", start, end },
      },
    ],
  };
}
