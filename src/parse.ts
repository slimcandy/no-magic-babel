import { Parser, type Program } from "acorn";

/**
 * Step 1: text → tree.
 *
 * Babel has its own parser (@babel/parser); here acorn does the same job.
 * First it cuts the text into tokens: `let`, `greet`, `=`, `(`, `name` …
 * Then it groups the tokens into a tree of plain objects, one per piece
 * of the program. That tree is called the AST (abstract syntax tree).
 */
export function parse(code: string): Program {
  return Parser.parse(code, { ecmaVersion: "latest", sourceType: "script" });
}
