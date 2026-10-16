# No magic in Babel

Babel turns new JavaScript into old JavaScript. It looks smart, but it doesn't understand code. It builds a tree, edits the tree and prints it back as text, following rules that people wrote, step by step. This repo is a tiny compiler that does the same, and a scroll story that shows every step.

**Live:** [babel.avolkov.dev](https://babel.avolkov.dev)

## The three steps

1. **Parse: text → tree.** [acorn](https://github.com/acornjs/acorn) cuts the text into tokens and builds a tree of plain objects (the AST). Babel has its own parser; the idea is the same.
2. **Traverse: walk the tree, let the rules edit it.** The walker enters every node, goes into its children and leaves. It knows only where each node type keeps its children. A rule names the node type it wants and changes it in small, named steps.
3. **Generate: tree → text.** The printer walks the edited tree and writes a few characters for each node.

```
let greet = (name) => "Hi, " + name;
```

becomes, with the rules `let → var` and `arrow → function`:

```js
var greet = function (name) {
  return "Hi, " + name;
};
```

the same output as Babel's own plugins.

## Not almighty

The arrow rule in `src/rules/arrow-functions.ts` has two steps and no idea what `this` means, so it breaks code like `this.read = () => this.count`. `src/rules/arrow-functions-this.ts` adds the two steps Babel uses (`var _this = this`). Nothing guesses: a node type the walker or the printer has no lines for stops with an error, e.g. `I don't know how to print a ClassDeclaration`.

## Files

| File | What it does |
|---|---|
| `src/parse.ts` | text → tree, with acorn |
| `src/traverse.ts` | the walker, and the list of where each node type keeps its children |
| `src/rules/*.ts` | the rules, written as steps |
| `src/generate.ts` | tree → text |
| `src/demo.ts` | `npm start`: the three steps in the terminal |
| `tests/compile.test.ts` | the judge: the output must parse as ES5 (acorn with `ecmaVersion: 5`) and do the same thing as the input when run |
| `site/` | the scroll story. `record.ts` runs the real compiler once and keeps every moment as a frame; `tree.ts` draws the frames |

## Run it

Node.js 22.18 or newer.

```sh
git clone https://github.com/slimcandy/no-magic-babel
cd no-magic-babel
npm install
npm start     # the three steps, printed
npm test      # Vitest
npm run dev   # the page, at http://localhost:5173
```

## Credits

It started from Mohammad Taheri's article [Write your own Babel](https://mohammadtaheri.medium.com/write-your-own-babel-54ab880f1dfd). Also useful: the [Babel plugin handbook](https://github.com/jamiebuilds/babel-handbook) and [AST Explorer](https://astexplorer.net/). The page's pixel font is [Silkscreen](https://fonts.google.com/specimen/Silkscreen) by Jason Kottke (SIL Open Font License).

MIT licence.
