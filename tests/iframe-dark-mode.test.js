const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createFrameDocument() {
    let darkStyle = null;
    const classes = new Set();
    return {
        body: {
            classList: {
                add: value => classes.add(value),
                remove: value => classes.delete(value),
                contains: value => classes.has(value)
            }
        },
        createElement: () => ({ id: "", textContent: "" }),
        documentElement: {
            prepend: value => { darkStyle = value; },
            querySelector: selector => selector === "#darkcss" ? darkStyle : null
        },
        get darkStyle() { return darkStyle; }
    };
}

function createFrame(frameDocument) {
    const listeners = {};
    return {
        nodeType: 1,
        nodeName: "IFRAME",
        contentDocument: frameDocument,
        addEventListener: (name, callback) => { listeners[name] = callback; },
        querySelectorAll: () => [],
        dispatchLoad: () => listeners.load?.()
    };
}

function loadContentScript(existingFrames = []) {
    const observers = [];
    const adaptedDocuments = [];
    class MockMutationObserver {
        constructor(callback) {
            this.callback = callback;
            this.disconnected = false;
            observers.push(this);
        }
        disconnect() { this.disconnected = true; }
        observe() {}
    }

    const context = vm.createContext({
        BetterCanvasAdaptiveColors: {
            darkModeCSS: () => ".adaptive-colors{}",
            observeDocument: document => adaptedDocuments.push(document)
        },
        MutationObserver: MockMutationObserver,
        URL,
        chrome: {
            runtime: { onMessage: { addListener() {} } },
            storage: {
                local: { get() {}, set() {} },
                onChanged: { addListener() {} },
                sync: {
                    get: (_keys, callback) => callback({
                        custom_domain: ["not-this-origin.example"],
                        dark_mode: false,
                        dark_preset: {},
                        device_dark: false,
                        remind: false
                    })
                }
            }
        },
        clearInterval() {},
        clearTimeout() {},
        console,
        document: {
            documentElement: {},
            querySelectorAll: selector => selector === "iframe" ? existingFrames : []
        },
        fetch() {},
        performance: { now: () => 0 },
        setInterval() {},
        setTimeout() {},
        window: { location: { origin: "https://canvas.example", pathname: "/courses/1/pages/test" } }
    });

    vm.runInContext(fs.readFileSync("js/content.js", "utf8"), context);
    return {
        adaptedDocuments,
        observers,
        run: options => vm.runInContext(
            `options = ${JSON.stringify(options)}; runiframeChecker()`,
            context
        )
    };
}

test("syncs existing and later-loaded iframes in device dark mode", () => {
    const existingDocument = createFrameDocument();
    const existingFrame = createFrame(existingDocument);
    const pendingFrame = createFrame(null);
    const runtime = loadContentScript([existingFrame, pendingFrame]);

    runtime.run({ dark_mode: false, device_dark: true, dark_preset: {} });

    assert.match(existingDocument.darkStyle.textContent, /@media \(prefers-color-scheme: dark\)/);
    assert.equal(existingDocument.body.classList.contains("bettercanvas--darkmode--enabled"), true);
    assert.equal(runtime.adaptedDocuments.includes(existingDocument), true);

    const loadedDocument = createFrameDocument();
    pendingFrame.contentDocument = loadedDocument;
    pendingFrame.dispatchLoad();
    assert.ok(loadedDocument.darkStyle);
    assert.equal(runtime.adaptedDocuments.includes(loadedDocument), true);
});

test("finds every direct and nested iframe in added nodes", () => {
    const runtime = loadContentScript();
    runtime.run({ dark_mode: true, device_dark: false, dark_preset: {} });

    const directDocument = createFrameDocument();
    const nestedDocument = createFrameDocument();
    const directFrame = createFrame(directDocument);
    const nestedFrame = createFrame(nestedDocument);
    const wrapper = {
        nodeType: 1,
        nodeName: "DIV",
        querySelectorAll: selector => selector === "iframe" ? [nestedFrame] : []
    };

    runtime.observers.at(-1).callback([{
        type: "childList",
        addedNodes: [{ nodeType: 3 }, directFrame, wrapper]
    }]);

    assert.ok(directDocument.darkStyle);
    assert.ok(nestedDocument.darkStyle);
});

test("removes iframe dark styles when dark mode is disabled", () => {
    const frameDocument = createFrameDocument();
    const runtime = loadContentScript([createFrame(frameDocument)]);
    runtime.run({ dark_mode: true, device_dark: false, dark_preset: {} });
    runtime.run({ dark_mode: false, device_dark: false, dark_preset: {} });

    assert.equal(frameDocument.darkStyle.textContent, "");
    assert.equal(frameDocument.body.classList.contains("bettercanvas--darkmode--enabled"), false);
    assert.equal(runtime.observers[0].disconnected, true);
});
