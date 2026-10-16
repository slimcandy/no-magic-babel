import "./style.css";
import { arrowFunctions, arrowFunctionsThis, compile, letToVar, parse } from "../src/index.ts";
import { counter, greet } from "../src/examples.ts";
import { plain, record, type Frame, type ViewNode } from "./record.ts";
import { sprite } from "./sprite.ts";
import { TreeView } from "./tree.ts";

import parseSource from "../src/parse.ts?raw";
import traverseSource from "../src/traverse.ts?raw";
import letToVarSource from "../src/rules/let-to-var.ts?raw";
import arrowSource from "../src/rules/arrow-functions.ts?raw";
import arrowThisSource from "../src/rules/arrow-functions-this.ts?raw";
import generateSource from "../src/generate.ts?raw";
import indexSource from "../src/index.ts?raw";

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

// ---- The recording: the real compiler, run once, every moment kept.

const { frames, parsed, walked } = record(greet, [letToVar, arrowFunctions]);
const firstRule = frames.findIndex((frame) => frame.verb === "rule");
const lastRule = frames.findLastIndex((frame) => frame.verb === "rule");
const last = frames.length - 1;

// The node scene: the tree as parsed, with the VariableDeclaration picked out.
const declaration = frames[parsed].tree!.children[0];
const nodeFrame: Frame = { ...frames[parsed], at: declaration.id, say: "VariableDeclaration is a plain object" };

/** Which frames each scene scrubs through as you scroll it. */
const ranges: Record<string, [number, number]> = {
  code: [0, 0],
  tokens: [0, 0],
  tree: [1, parsed],
  node: [-1, -1],
  walker: [parsed + 1, parsed + 1],
  rule1: [parsed + 2, firstRule],
  rule2: [firstRule + 1, lastRule],
  walk: [lastRule + 1, walked],
  print: [walked + 1, last - 1],
  done: [last, last],
};

const frameAt = (index: number) => (index === -1 ? nodeFrame : frames[index]);

// ---- The stage.

const tree = new TreeView($<SVGSVGElement>("#tree"), frames);
const story = $("#story");
const source = $("#source");
const output = $("#output");
const outputPanel = $("#output-panel");
const json = $("#json");
const verb = $("#verb");
const say = $("#say");
json.textContent = plain(parse(greet).body[0]);

const verbs: Record<Frame["verb"], string> = { text: "Text", make: "Parse", enter: "Enter", leave: "Leave", rule: "Rule", write: "Write", done: "Done" };

let current: Frame | null = null;
let hovered: ViewNode | null = null;

function find(node: ViewNode | null, id: number | null): ViewNode | null {
  if (!node || id === null) return null;
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

function highlight(element: HTMLElement, text: string, start: number, end: number) {
  const mark = document.createElement("mark");
  mark.textContent = text.slice(start, end);
  element.replaceChildren(text.slice(0, start), ...(end > start ? [mark] : []), text.slice(end));
}

function paintSource() {
  if (!current) return;
  const node = hovered ?? find(current.tree, current.at);
  highlight(source, greet, node?.start ?? 0, node?.end ?? 0);
}

function render(frame: Frame, scene: string) {
  const changed = frame !== current;
  current = frame;
  paintSource();
  if (!changed) return;

  tree.show(frame);
  verb.textContent = verbs[frame.verb];
  verb.dataset.verb = frame.verb;
  say.textContent = frame.say;
  story.dataset.scene = scene;
  json.hidden = scene !== "node";
  outputPanel.hidden = !(scene === "print" || scene === "done");
  highlight(output, frame.output, frame.output.length - frame.last.length, frame.output.length);
}

tree.onHover = (node) => {
  hovered = node;
  paintSource();
};

// ---- Scrolling: the scene under the reading line picks the frame.

const scenes = [...document.querySelectorAll<HTMLElement>("[data-scene]")];
for (const scene of scenes) {
  const [from, to] = ranges[scene.dataset.scene!];
  scene.style.setProperty("--frames", String(to - from + 1));
}

const phaseLinks = [...document.querySelectorAll<HTMLElement>("[data-phase-link]")];
const phases = ["parse", "traverse", "generate"];

function setPhase(phase: string | undefined, after: boolean) {
  const index = after ? phases.length : phase ? phases.indexOf(phase) : -1;
  phaseLinks.forEach((link, i) => {
    link.classList.toggle("is-done", i < index);
    if (i === index) link.setAttribute("aria-current", "step");
    else link.removeAttribute("aria-current");
  });
}

const wide = matchMedia("(width >= 64rem)");
const cards = [...document.querySelectorAll<HTMLElement>(".card")];

function update() {
  // On phones the card rides at the bottom of the screen, so a scene plays
  // while it's on screen. On wide screens, while it crosses the middle.
  const line = innerHeight * (wide.matches ? 0.55 : 1);
  let active = scenes[0];
  for (const scene of scenes) if (scene.getBoundingClientRect().top <= line) active = scene;

  const rect = active.getBoundingClientRect();
  const progress = Math.min(1, Math.max(0, (line - rect.top) / rect.height));
  const [from, to] = ranges[active.dataset.scene!];
  const index = from + Math.min(to - from, Math.floor(progress * (to - from + 1)));
  render(frameAt(index), active.dataset.scene!);

  setPhase(active.dataset.phase, story.getBoundingClientRect().bottom < line);

  // On phones a card that's done slides up over the stage: fade it out.
  for (const card of cards) {
    if (wide.matches) {
      card.style.opacity = "";
      continue;
    }
    const box = card.getBoundingClientRect();
    const resting = innerHeight - box.height - 12;
    card.style.opacity = String(1 - Math.min(1, Math.max(0, (resting - box.top) / (innerHeight * 0.15))));
  }
}


let queued = false;
const schedule = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    update();
  });
};
addEventListener("scroll", schedule, { passive: true });
addEventListener("resize", schedule);
update();

// ---- Not almighty: the same rule, with and without the steps for `this`.

$("#counter-input").textContent = counter;
$("#counter-naive").textContent = compile(counter, [letToVar, arrowFunctions]).trimEnd();
$("#counter-fixed").textContent = compile(counter, [letToVar, arrowFunctionsThis]).trimEnd();
try {
  compile("class Dog {}", []);
} catch (error) {
  $("#error").textContent = `compile("class Dog {}")\n// Error: ${(error as Error).message}`;
}

// ---- The whole compiler, file by file.

const files: [string, string][] = [
  ["src/parse.ts", parseSource],
  ["src/traverse.ts", traverseSource],
  ["src/rules/let-to-var.ts", letToVarSource],
  ["src/rules/arrow-functions.ts", arrowSource],
  ["src/rules/arrow-functions-this.ts", arrowThisSource],
  ["src/generate.ts", generateSource],
  ["src/index.ts", indexSource],
];

/** Lines of code, without comments and blank lines. */
const countLines = (text: string) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("//")).length;

let total = 0;
for (const [name, text] of files) {
  const lines = countLines(text);
  total += lines;
  const details = document.createElement("details");
  details.className = "file";
  details.innerHTML = `<summary><span class="file-name"></span><span class="file-lines">${lines} lines</span></summary><pre><code></code></pre>`;
  details.querySelector(".file-name")!.textContent = name;
  details.querySelector("code")!.textContent = text.trimEnd();
  $("#files").append(details);
}
$("#total-lines").textContent = String(total);

// ---- A code block or a card that scrolls gets a tab stop, so the keyboard can scroll it too.

function focusScrollable() {
  for (const box of document.querySelectorAll<HTMLElement>("pre, .card")) {
    if (box.scrollWidth > box.clientWidth || box.scrollHeight > box.clientHeight) box.tabIndex = 0;
    else box.removeAttribute("tabindex");
  }
}
focusScrollable();
document.fonts.ready.then(focusScrollable);
addEventListener("resize", focusScrollable);
document.addEventListener("toggle", focusScrollable, true);

// ---- Decoration: the builder on the hero, and the pixel sun.

$(".hero-builder").innerHTML = sprite("a", "hero-sprite");

const sun = $<SVGSVGElement>(".sun");
// Bands cut out of the lower half, wider further down: the 1980s sunset.
const gaps = new Set([18, 21, 22, 25, 26, 27, 29, 30]);
for (let y = 0; y < 32; y++) {
  if (gaps.has(y)) continue;
  const half = Math.round(Math.sqrt(Math.max(0, 16 ** 2 - (y - 15.5) ** 2)));
  const row = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  Object.entries({ x: 16 - half, y, width: half * 2, height: 1, class: "sun-row" }).forEach(([key, value]) => row.setAttribute(key, String(value)));
  row.style.setProperty("--y", String(y));
  sun.append(row);
}
