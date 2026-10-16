import { parse } from "./parse.ts";
import { traverse, type Rule } from "./traverse.ts";
import { generate } from "./generate.ts";

export { parse, traverse, generate, type Rule };
export { letToVar } from "./rules/let-to-var.ts";
export { arrowFunctions } from "./rules/arrow-functions.ts";
export { arrowFunctionsThis } from "./rules/arrow-functions-this.ts";

/** All of it: text → tree → edited tree → text. */
export function compile(code: string, rules: Rule[]): string {
  const ast = parse(code);
  traverse(ast, rules);
  return generate(ast);
}
