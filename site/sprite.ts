// The walker: a builder in a hard hat, carrying the rulebook. Drawn the
// 1986 way, pixel by pixel, but each pixel is an SVG <rect>.

const body = [
  "....YYYYY.....",
  "...YYYYYYY....",
  "...YYYHYYY....",
  "..HHHHHHHHHH..",
  "....SSSSSS....",
  "....SSSESS....",
  "....SSSSSS....",
  ".....SSSS.....",
  "...VVVVVVV....",
  "..VWVVVVWVRR..",
  "..VWVVVVSRRR..",
  "..VVWWWWVRRR..",
  "...BBBBBB.....",
];

const legs = {
  a: ["...BB..BB.....", "..BB....BB....", ".KKK....KKK..."],
  b: ["....BBBB......", "....BBBB......", "...KKKKKK....."],
};

// Reading the rulebook: the book is open and there's a "!" above the hat.
const reading = body.map((row, y) =>
  y === 9 ? "..VWVVVVSPPP.." : y === 10 ? "..VWVVVVSPRP.." : y === 0 ? row.slice(0, 12) + "X." : y === 1 ? row.slice(0, 12) + "X." : row,
);

export const frames = {
  a: [...body, ...legs.a],
  b: [...body, ...legs.b],
  read: [...reading, ...legs.a],
};

export type SpriteFrame = keyof typeof frames;

export const PIXEL = 2;
export const WIDTH = 14 * PIXEL;
export const HEIGHT = frames.a.length * PIXEL;

/** One <rect> per run of same-coloured pixels in a row. */
export function pixels(frame: SpriteFrame): string {
  let out = "";
  frames[frame].forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const color = row[x];
      let end = x;
      while (row[end] === color) end++;
      if (color !== ".") {
        out += `<rect class="px-${color}" x="${x * PIXEL}" y="${y * PIXEL}" width="${(end - x) * PIXEL}" height="${PIXEL}"/>`;
      }
      x = end;
    }
  });
  return out;
}

/** The builder as a standalone <svg>, for the hero and the cards. */
export function sprite(frame: SpriteFrame = "a", className = ""): string {
  return `<svg class="sprite ${className}" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" shape-rendering="crispEdges" aria-hidden="true">${pixels(frame)}</svg>`;
}
