import { Game } from "./game.js";
import { UI } from "./ui.js";

const canvas = document.querySelector("#c");
const ui = new UI();
const game = new Game({ canvas, ui });

game.start();

// UI -> game
ui.onToggleFullMode((v) => game.setFullMode(v));
ui.onToggleGrowMode((v) => game.setGrowMode(v));
ui.onGrowShrink(() => game.growOrShrink());
ui.onReset(() => game.reset());

// Play mode switch (start on Clear mode)
ui.onTogglePlayModeSnake((isSnake) => game.setPlayMode(isSnake ? "snake" : "clear"));

// Mobile: directions + action
ui.onMoveDir((dir) => game.handleDirInput(dir));
ui.onAction(() => game.handleAction());

// Explicit grow/shrink
ui.onGrowShrinkExplicit({
  onGrow: () => game.growGrid(),
  onShrink: () => game.shrinkGrid(),
});

// Keyboard
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();

  if (k === "arrowup" || k === "w") game.handleDirInput("up");
  else if (k === "arrowdown" || k === "s") game.handleDirInput("down");
  else if (k === "arrowleft" || k === "a") game.handleDirInput("left");
  else if (k === "arrowright" || k === "d") game.handleDirInput("right");
  else if (k === " ") game.handleAction();
  else if (k === "g") game.growGrid();
  else if (k === "h") game.shrinkGrid();
  else if (k === "r") game.reset();
  else if (k === "z") game.placeTileAtCursor();
  else if (k === "x") game.godClearAll(); // GOD MODE

});

window.addEventListener("keydown", (e) => {
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
}, { passive: false });
