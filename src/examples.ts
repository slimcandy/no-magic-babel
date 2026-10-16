/** The code the page follows from start to end. */
export const greet = `let greet = (name) => "Hi, " + name;`;

/** Code where an arrow function's `this` matters. `read()` returns 1. */
export const counter = `function Counter() {
  this.count = 1;
  this.read = () => this.count;
}
let read = new Counter().read;
read();`;
