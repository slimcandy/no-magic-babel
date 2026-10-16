// Run with `npm start`: the three steps, printed one after another.
import { parse, traverse, generate, letToVar, arrowFunctions } from "./index.ts";
import { greet } from "./examples.ts";

console.log("1. The code is just text:\n");
console.log("  " + greet);

const ast = parse(greet);
console.log("\n2. acorn turns it into a tree of plain objects:\n");
console.log(JSON.stringify(ast, (key, value) => (key === "start" || key === "end" ? undefined : value), 2));

console.log("\n3. The walker visits every node, and the rules change some of them:\n");
traverse(ast, [letToVar, arrowFunctions], {
  enter: (node) => console.log(`  enter ${node.type}`),
  step: (rule, what) => console.log(`    ${rule.name}: ${what}`),
});

console.log("\n4. The printer turns the tree back into text:\n");
console.log(generate(ast));
