// Draws the tree of a frame as SVG and moves the walker over it.
// Two layouts: "down" (a real top-down tree) for wide stages, and "list"
// (an indented tree, like a file tree) for phones.
import type { Frame, ViewNode } from "./record.ts";
import { HEIGHT as SPRITE_H, WIDTH as SPRITE_W, pixels, type SpriteFrame } from "./sprite.ts";

type Mode = "down" | "list";
type Box = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };

const SVG = "http://www.w3.org/2000/svg";
// Character widths of the monospace fonts, measured once the fonts load.
let CHAR = 6.6; // 11px
let BIG_CHAR = 8.4; // 14px bold, the label in "down" mode

function boxWidth(node: ViewNode, mode: Mode) {
  if (mode === "down") return Math.max(node.type.length * CHAR, node.label.length * BIG_CHAR) + 16;
  const key = node.key ? node.key.length + 2 : 0;
  const label = node.label ? node.label.length + 1 : 0;
  return (key + node.type.length + label) * CHAR + 14;
}

function layout(root: ViewNode, mode: Mode): Map<number, Box> {
  const boxes = new Map<number, Box>();

  if (mode === "list") {
    let row = 0;
    (function place(node: ViewNode, depth: number) {
      boxes.set(node.id, { x: depth * 16, y: row++ * 30, w: boxWidth(node, mode), h: 22 });
      node.children.forEach((child) => place(child, depth + 1));
    })(root, 0);
    return boxes;
  }

  const GAP_X = 14;
  const LEVEL = 76;
  const widths = new Map<number, number>();
  const width = (node: ViewNode): number => {
    const own = boxWidth(node, mode);
    const kids = node.children.reduce((sum, child) => sum + width(child), 0) + GAP_X * Math.max(0, node.children.length - 1);
    const total = Math.max(own, kids);
    widths.set(node.id, total);
    return total;
  };
  width(root);

  (function place(node: ViewNode, left: number, depth: number) {
    const total = widths.get(node.id)!;
    const w = boxWidth(node, mode);
    boxes.set(node.id, { x: left + (total - w) / 2, y: depth * LEVEL + 36, w, h: 40 });
    const kids = node.children.reduce((sum, child) => sum + widths.get(child.id)!, 0) + GAP_X * Math.max(0, node.children.length - 1);
    let x = left + (total - kids) / 2;
    for (const child of node.children) {
      place(child, x, depth + 1);
      x += widths.get(child.id)! + GAP_X;
    }
  })(root, 0, 0);
  return boxes;
}

function flatten(node: ViewNode, out: ViewNode[] = [], parent?: ViewNode, parents = new Map<number, ViewNode>()) {
  out.push(node);
  if (parent) parents.set(node.id, parent);
  node.children.forEach((child) => flatten(child, out, node, parents));
  return { nodes: out, parents };
}

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}) {
  const element = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  return element;
}

export class TreeView {
  private mode: Mode = "down";
  private frame: Frame | null = null;
  private groups = new Map<number, SVGGElement>();
  private edges = new Map<number, SVGPathElement>();
  private shown = new Map<number, Point>();
  private walker: Point | null = null;
  private facing = 1;
  private animation = 0;
  private edgeLayer = el("g", { class: "edges" });
  private nodeLayer = el("g", { class: "nodes" });
  private walkerLayer = el("g", { class: "walker", "shape-rendering": "crispEdges" });
  private reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  onHover: (node: ViewNode | null) => void = () => {};

  private svg: SVGSVGElement;
  private frames: Frame[];

  constructor(svg: SVGSVGElement, frames: Frame[]) {
    this.svg = svg;
    this.frames = frames;
    svg.append(this.edgeLayer, this.nodeLayer, this.walkerLayer);
    new ResizeObserver(() => this.fit()).observe(svg.parentElement!);
    document.fonts.ready.then(() => {
      this.measure();
      this.fit(true);
    });
  }

  private measure() {
    const probe = el("text", { class: "type" });
    probe.textContent = "0".repeat(20);
    this.svg.append(probe);
    CHAR = probe.getComputedTextLength() / 20 || CHAR;
    probe.setAttribute("class", "label");
    this.svg.dataset.mode = "down";
    BIG_CHAR = probe.getComputedTextLength() / 20 || BIG_CHAR;
    probe.remove();
  }

  /** Picks the layout for the stage's shape, and a viewBox that fits every frame. */
  private fit(force = false) {
    const { width } = this.svg.parentElement!.getBoundingClientRect();
    const mode: Mode = width < 560 ? "list" : "down";
    if (mode === this.mode && this.svg.hasAttribute("viewBox") && !force) return;
    this.mode = mode;

    let right = 0;
    let bottom = 0;
    for (const frame of this.frames) {
      if (!frame.tree) continue;
      for (const box of layout(frame.tree, mode).values()) {
        right = Math.max(right, box.x + box.w + (mode === "list" ? SPRITE_W + 8 : 0));
        bottom = Math.max(bottom, box.y + box.h);
      }
    }
    const pad = 6;
    this.svg.setAttribute("viewBox", `${-pad} ${-pad - (mode === "down" ? 0 : 4)} ${right + 2 * pad} ${bottom + 2 * pad + 4}`);
    this.svg.dataset.mode = mode;
    this.groups.forEach((group) => group.remove());
    this.edges.forEach((edge) => edge.remove());
    this.groups.clear();
    this.edges.clear();
    this.shown.clear();
    this.walker = null;
    if (this.frame) this.show(this.frame, true);
  }

  show(frame: Frame, instant = false) {
    const previous = this.frame;
    this.frame = frame;
    if (!frame.tree) {
      this.nodeLayer.replaceChildren();
      this.edgeLayer.replaceChildren();
      this.walkerLayer.replaceChildren();
      this.groups.clear();
      this.edges.clear();
      this.shown.clear();
      return;
    }

    const { nodes, parents } = flatten(frame.tree);
    const visible = nodes.slice(0, frame.shown);
    const boxes = layout(frame.tree, this.mode);
    const ids = new Set(visible.map((node) => node.id));

    for (const [id, group] of this.groups) {
      if (!ids.has(id)) {
        group.remove();
        this.groups.delete(id);
        this.edges.get(id)?.remove();
        this.edges.delete(id);
        this.shown.delete(id);
      }
    }

    for (const node of visible) {
      let group = this.groups.get(node.id);
      if (!group) {
        group = this.createNode();
        this.groups.set(node.id, group);
        this.nodeLayer.append(group);
        const box = boxes.get(node.id)!;
        this.shown.set(node.id, { x: box.x, y: box.y });
        if (previous?.tree) group.classList.add("is-new");
      }
      this.updateNode(group, node, boxes.get(node.id)!);
      group.classList.toggle("is-at", node.id === frame.at);
      group.classList.toggle("is-changed", node.id === frame.changed);
      if (node.id === frame.changed) {
        // Restart the flash.
        group.classList.remove("is-changed");
        void group.getBoundingClientRect();
        group.classList.add("is-changed");
      }

      const parent = parents.get(node.id);
      if (parent && !this.edges.has(node.id)) {
        const edge = el("path", { class: "edge" });
        this.edges.set(node.id, edge);
        this.edgeLayer.append(edge);
      }
      this.edges.get(node.id)?.setAttribute("data-parent", String(parent?.id ?? ""));
    }

    const at = frame.at ? boxes.get(frame.at) : undefined;
    const walking = at && frame.verb !== "make" && frame.verb !== "text";
    const target = walking ? this.walkerSpot(at) : null;
    if (target && this.walker && target.x !== this.walker.x) this.facing = target.x < this.walker.x ? -1 : 1;

    this.animate(boxes, target, instant || this.reduceMotion.matches, frame.verb === "rule" ? "read" : null);
  }

  private walkerSpot(box: Box): Point {
    if (this.mode === "list") return { x: box.x + box.w + 6, y: box.y + box.h - SPRITE_H * 0.75 };
    return { x: box.x + 2, y: box.y - SPRITE_H * 1.25 + 1 };
  }

  private createNode(): SVGGElement {
    const group = el("g", { class: "node", tabindex: 0, role: "img" });
    group.append(el("rect", { class: "box" }), el("text", { class: "key" }), el("text", { class: "type" }), el("text", { class: "label" }));
    group.addEventListener("pointerenter", () => this.onHover(this.find(Number(group.dataset.id))));
    group.addEventListener("pointerleave", () => this.onHover(null));
    group.addEventListener("focus", () => this.onHover(this.find(Number(group.dataset.id))));
    group.addEventListener("blur", () => this.onHover(null));
    return group;
  }

  private find(id: number): ViewNode | null {
    if (!this.frame?.tree) return null;
    return flatten(this.frame.tree).nodes.find((node) => node.id === id) ?? null;
  }

  private updateNode(group: SVGGElement, node: ViewNode, box: Box) {
    group.dataset.id = String(node.id);
    group.setAttribute("aria-label", `${node.type}${node.label ? ` ${node.label}` : ""}`);
    const [rect, key, type, label] = group.children as unknown as [SVGRectElement, SVGTextElement, SVGTextElement, SVGTextElement];
    rect.setAttribute("width", String(box.w));
    rect.setAttribute("height", String(box.h));

    if (this.mode === "down") {
      key.textContent = node.key;
      key.setAttribute("x", String(box.w / 2 + 5));
      key.setAttribute("y", "-5");
      type.textContent = node.type;
      type.setAttribute("x", String(box.w / 2));
      type.setAttribute("y", node.label ? "15" : "24");
      type.setAttribute("text-anchor", "middle");
      label.textContent = node.label;
      label.setAttribute("x", String(box.w / 2));
      label.setAttribute("y", "32");
      label.setAttribute("text-anchor", "middle");
    } else {
      key.textContent = node.key ? `${node.key}:` : "";
      key.setAttribute("x", "7");
      key.setAttribute("y", "15");
      const keyWidth = node.key ? (node.key.length + 2) * CHAR : 0;
      type.textContent = node.type;
      type.setAttribute("x", String(7 + keyWidth));
      type.setAttribute("y", "15");
      type.setAttribute("text-anchor", "start");
      label.textContent = node.label;
      label.setAttribute("x", String(7 + keyWidth + (node.type.length + 1) * CHAR));
      label.setAttribute("y", "15");
      label.setAttribute("text-anchor", "start");
    }
  }

  private animate(boxes: Map<number, Box>, walkerTarget: Point | null, instant: boolean, pose: SpriteFrame | null) {
    cancelAnimationFrame(this.animation);
    const from = new Map(this.shown);
    const walkerFrom = this.walker ?? walkerTarget;
    const start = performance.now();
    const duration = instant ? 0 : 320;

    const tick = (now: number) => {
      const t = duration ? Math.min(1, (now - start) / duration) : 1;
      const ease = 1 - (1 - t) ** 3;

      for (const [id, group] of this.groups) {
        const box = boxes.get(id)!;
        const a = from.get(id) ?? box;
        const point = { x: a.x + (box.x - a.x) * ease, y: a.y + (box.y - a.y) * ease };
        this.shown.set(id, point);
        group.setAttribute("transform", `translate(${point.x} ${point.y})`);
      }
      for (const [id, edge] of this.edges) {
        const parent = Number(edge.dataset.parent);
        const a = this.shown.get(parent);
        const b = this.shown.get(id);
        const pa = boxes.get(parent);
        const pb = boxes.get(id);
        if (!a || !b || !pa || !pb) continue;
        edge.setAttribute(
          "d",
          this.mode === "down"
            ? `M${a.x + pa.w / 2} ${a.y + pa.h}V${(a.y + pa.h + b.y) / 2}H${b.x + pb.w / 2}V${b.y}`
            : `M${a.x + 8} ${a.y + pa.h}V${b.y + pb.h / 2}H${b.x}`,
        );
      }

      if (walkerTarget && walkerFrom) {
        const point = { x: walkerFrom.x + (walkerTarget.x - walkerFrom.x) * ease, y: walkerFrom.y + (walkerTarget.y - walkerFrom.y) * ease };
        this.walker = point;
        const moving = t < 1 && (walkerFrom.x !== walkerTarget.x || walkerFrom.y !== walkerTarget.y);
        const frame: SpriteFrame = pose ?? (moving && Math.floor(now / 110) % 2 ? "b" : "a");
        const scale = this.mode === "list" ? 0.75 : 1.25;
        const flip = this.facing < 0 ? `translate(${SPRITE_W} 0) scale(-1 1)` : "";
        if (this.walkerLayer.dataset.frame !== frame) {
          this.walkerLayer.innerHTML = `<g>${pixels(frame)}</g>`;
          this.walkerLayer.dataset.frame = frame;
        }
        (this.walkerLayer.firstElementChild as SVGGElement).setAttribute("transform", `translate(${point.x} ${point.y}) scale(${scale}) ${flip}`);
      } else {
        this.walker = null;
        this.walkerLayer.replaceChildren();
        delete this.walkerLayer.dataset.frame;
      }

      if (t < 1) this.animation = requestAnimationFrame(tick);
    };
    this.animation = requestAnimationFrame(tick);
  }
}
