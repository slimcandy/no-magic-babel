import { runInNewContext } from "node:vm";
import { Parser } from "acorn";
import { describe, expect, test } from "vitest";
import { arrowFunctions, arrowFunctionsThis, compile, generate, letToVar, parse } from "../src/index.ts";
import { counter, greet } from "../src/examples.ts";

// Runs a script in a fresh, empty world and returns its last value.
const run = (code: string) => runInNewContext(code);

// acorn in ES5 mode knows no `let` and no `=>`: if it parses, it's old JavaScript.
const isES5 = (code: string) => Parser.parse(code, { ecmaVersion: 5 }) && true;

describe("greet", () => {
  const output = compile(greet, [letToVar, arrowFunctions]);

  test("becomes old JavaScript", () => {
    expect(output).toBe(`var greet = function (name) {\n  return "Hi, " + name;\n};\n`);
    expect(isES5(output)).toBe(true);
  });

  test("still does the same thing", () => {
    expect(run(output + `greet("Ada")`)).toBe(run(greet + `greet("Ada")`));
  });

  test("prints back unchanged without rules", () => {
    expect(compile(greet, [])).toBe(greet + "\n");
  });
});

describe("counter", () => {
  test("works before the rules", () => {
    expect(run(counter)).toBe(1);
  });

  test("breaks with the naive arrow rule", () => {
    const output = compile(counter, [letToVar, arrowFunctions]);
    expect(isES5(output)).toBe(true);
    expect(run(output)).toBeUndefined();
  });

  test("works with the rule that keeps this", () => {
    const output = compile(counter, [letToVar, arrowFunctionsThis]);
    expect(output).toBe(
      [
        "function Counter() {",
        "  var _this = this;",
        "  this.count = 1;",
        "  this.read = function () {",
        "    return _this.count;",
        "  };",
        "}",
        "var read = new Counter().read;",
        "read();",
        "",
      ].join("\n"),
    );
    expect(isES5(output)).toBe(true);
    expect(run(output)).toBe(1);
  });
});

test("stops at code it has no lines for", () => {
  expect(() => compile("class A {}", [])).toThrow("I don't know where a ClassDeclaration keeps its children");
  expect(() => generate(parse("class A {}"))).toThrow("I don't know how to print a ClassDeclaration");
});

test("keeps brackets the tree needs", () => {
  expect(compile("let x = (1 + 2) * (3 - (4 - 5));", [])).toBe("let x = (1 + 2) * (3 - (4 - 5));\n");
});
