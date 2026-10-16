import type { ArrowFunctionExpression, FunctionExpression } from "acorn";
import type { Context, Rule } from "../traverse.ts";

/**
 * Old browsers don't know `() =>`. This rule rewrites an arrow function as
 * a `function`, in two steps.
 *
 * It doesn't know what `this` means, so it breaks code that uses `this`.
 * arrow-functions-this.ts is the same rule with the steps that fix it.
 */
export const arrowFunctions: Rule = {
  name: "arrow → function",
  visitor: {
    ArrowFunctionExpression(arrow, { step }) {
      toFunction(arrow, step);
    },
  },
};

export function toFunction(arrow: ArrowFunctionExpression, step: Context["step"]) {
  // The same object, about to get a new type.
  const node = arrow as unknown as FunctionExpression;

  step("Change type to FunctionExpression", () => {
    node.type = "FunctionExpression";
  });

  // `name => "Hi, " + name` has no { } and no `return`. A function needs both.
  if (arrow.body.type !== "BlockStatement") {
    const body = arrow.body;
    // New nodes point at the source they came from.
    const { start, end } = body;
    step("Wrap the body in { return … }", () => {
      node.body = { type: "BlockStatement", start, end, body: [{ type: "ReturnStatement", start, end, argument: body }] };
      node.expression = false;
    });
  }
}
