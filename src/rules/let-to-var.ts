import type { Rule } from "../traverse.ts";

/**
 * Old browsers only know `var`. This rule changes one word.
 *
 * It doesn't know that `let` lives only inside its { } and `var` doesn't.
 * Babel's real rule has more steps for that: it renames variables that
 * would clash.
 */
export const letToVar: Rule = {
  name: "let → var",
  visitor: {
    VariableDeclaration(node, { step }) {
      if (node.kind !== "let") return;

      step("Change kind from let to var", () => {
        node.kind = "var";
      });
    },
  },
};
