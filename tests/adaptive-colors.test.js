const test = require("node:test");
const assert = require("node:assert/strict");
const { adaptAuthoredValues, adaptStyleText, darkModeCSS, parseDeclarations } = require("../js/adaptive-colors.js");

test("adapts inline foreground and background colors", () => {
    const result = adaptStyleText("background-color: #fff4b8; color: rgb(20, 20, 20) !important");

    assert.deepEqual(result.roles, ["background", "foreground"]);
    assert.match(result.style, /--bettercanvas-authored-background-light: #fff4b8/);
    assert.match(result.style, /background-color: var\(--bettercanvas-authored-background\)/);
    assert.match(result.style, /color: var\(--bettercanvas-authored-foreground\) !important/);
});

test("preserves border width and style while adapting its color", () => {
    const result = adaptStyleText("border: 2px solid #d1d5db; border-left: 6px solid rgb(232, 174, 0)");

    assert.match(result.style, /border: 2px solid var\(--bettercanvas-authored-border\)/);
    assert.match(result.style, /border-left: 6px solid var\(--bettercanvas-authored-border-left\)/);
    assert.match(result.style, /--bettercanvas-authored-border-left-light: rgb\(232, 174, 0\)/);
});

test("leaves gradients and background images unchanged", () => {
    const style = "background: linear-gradient(#fff, #ddd); background-image: url('data:image/svg+xml;charset=utf-8,<svg></svg>'); color: #222";
    const result = adaptStyleText(style);

    assert.equal(result.style, style);
    assert.deepEqual(result.roles, []);
});

test("does not split semicolons inside CSS functions", () => {
    const declarations = parseDeclarations("background-image: url('data:image/svg+xml;charset=utf-8,<svg></svg>'); color: #123");
    assert.equal(declarations.length, 2);
});

test("preserves alpha-bearing colors as the light value", () => {
    const result = adaptStyleText("background-color: rgba(255, 200, 0, 0.35)");
    assert.match(result.style, /--bettercanvas-authored-background-light: rgba\(255, 200, 0, 0\.35\)/);
});

test("keeps legacy attributes out of visible inline properties", () => {
    const result = adaptAuthoredValues("font-weight: bold", "#fff4b8", "#4a3700");
    const declarations = parseDeclarations(result.style);

    assert.deepEqual(result.roles, ["background", "foreground"]);
    assert.match(result.style, /--bettercanvas-authored-background-light: #fff4b8/);
    assert.match(result.style, /--bettercanvas-authored-foreground-light: #4a3700/);
    assert.equal(declarations.some(({ property }) => property === "background-color"), false);
    assert.equal(declarations.some(({ property }) => property === "color"), false);
});

test("does not let legacy attributes replace inline colors", () => {
    const result = adaptAuthoredValues("background-color: #123456; color: #abcdef", "#fff", "#000");

    assert.match(result.style, /--bettercanvas-authored-background-light: #123456/);
    assert.match(result.style, /--bettercanvas-authored-foreground-light: #abcdef/);
    assert.doesNotMatch(result.style, /--bettercanvas-authored-background-light: #fff(?:;|$)/);
    assert.doesNotMatch(result.style, /--bettercanvas-authored-foreground-light: #000(?:;|$)/);
});

test("generates hue-preserving dark rules for every adaptive role", () => {
    const css = darkModeCSS();
    assert.match(css, /max\(l, 0\.88\) calc\(c \* 0\.85\) h \/ alpha/);
    assert.match(css, /clamp\(0\.19, calc\(l \* 0\.3\), 0\.34\)/);
    assert.match(css, /clamp\(0\.28, calc\(l \* 0\.5\), 0\.5\)/);
    assert.match(css, /border-left-color:var\(--bettercanvas-authored-border-left\)!important/);
    assert.doesNotMatch(css, /--bc(?:background|text|borders|links)/);
});
