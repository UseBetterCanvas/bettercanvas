(function (root, factory) {
    const api = factory();
    root.BetterCanvasAdaptiveColors = api;
    if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    // Canvas uses these containers for rich content such as assignments, pages,
    // announcements, discussions, syllabi, and quiz descriptions. Keeping this
    // boundary narrow prevents authored-color adaptation from becoming a theme.
    const authoredContentSelector = ".user_content, .entry-content, #quiz_show .description";
    const adaptedAttribute = "data-bettercanvas-adaptive-colors";
    const observedDocuments = new WeakSet();

    const adaptiveProperties = {
        "color": "foreground",
        "background-color": "background",
        "background": "background",
        "border-color": "border",
        "border": "border",
        "border-top-color": "border-top",
        "border-top": "border-top",
        "border-right-color": "border-right",
        "border-right": "border-right",
        "border-bottom-color": "border-bottom",
        "border-bottom": "border-bottom",
        "border-left-color": "border-left",
        "border-left": "border-left"
    };

    const borderShorthands = new Set([
        "border",
        "border-top",
        "border-right",
        "border-bottom",
        "border-left"
    ]);

    const nonColorKeywords = new Set([
        "currentcolor", "dashed", "dotted", "double", "groove", "inherit",
        "initial", "hidden", "inset", "medium", "none", "outset", "revert",
        "revert-layer", "ridge", "solid", "thick", "thin", "transparent", "unset"
    ]);

    function observeDocument(doc) {
        if (!doc || !doc.documentElement || observedDocuments.has(doc)) return;
        observedDocuments.add(doc);
        adaptAuthoredColors(doc);

        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    adaptAddedNode(node);
                });
            });
        });
        observer.observe(doc.documentElement, { childList: true, subtree: true });
    }

    function adaptAuthoredColors(scope) {
        if (!scope || typeof scope.querySelectorAll !== "function") return;
        scope.querySelectorAll(authoredContentSelector).forEach(adaptTree);
        if (typeof scope.matches === "function" && scope.matches(authoredContentSelector)) {
            adaptTree(scope);
        }
    }

    function adaptAddedNode(node) {
        if (node.matches(authoredContentSelector)) {
            adaptTree(node);
            return;
        }

        if (node.closest(authoredContentSelector)) adaptTree(node);
        node.querySelectorAll(authoredContentSelector).forEach(adaptTree);
    }

    function adaptTree(rootElement) {
        adaptElement(rootElement);
        rootElement.querySelectorAll("[style], [color], [bgcolor]").forEach(adaptElement);
    }

    function adaptElement(element) {
        if (element.hasAttribute(adaptedAttribute)) return;

        const result = adaptAuthoredValues(
            element.getAttribute("style") || "",
            element.getAttribute("bgcolor"),
            element.getAttribute("color")
        );

        if (result.roles.length === 0) return;

        element.setAttribute("style", result.style);
        result.roles.forEach(role => element.classList.add("bettercanvas-adaptive-" + role));
        element.setAttribute(adaptedAttribute, "");
    }

    function adaptAuthoredValues(style, legacyBackground, legacyForeground) {
        const declarations = parseDeclarations(style);
        const hasComplexBackground = declarations.some(isComplexBackgroundDeclaration);
        const adaptedDeclarations = [];
        const roles = new Set();

        declarations.forEach(declaration => {
            const role = adaptiveProperties[declaration.property];
            if (role === "foreground" && hasComplexBackground) {
                adaptedDeclarations.push(declaration);
                return;
            }
            const adaptiveColor = role
                ? findAdaptiveColor(declaration.property, declaration.value)
                : null;

            if (!role || !adaptiveColor) {
                adaptedDeclarations.push(declaration);
                return;
            }

            adaptedDeclarations.push(lightColorDeclaration(role, adaptiveColor.lightColor));
            adaptedDeclarations.push({
                property: declaration.property,
                value: adaptiveColor.adaptedValue,
                important: declaration.important
            });
            roles.add(role);
        });

        if (
            legacyBackground &&
            isSimpleColor(legacyBackground) &&
            !hasComplexBackground &&
            !roles.has("background")
        ) {
            adaptedDeclarations.push(lightColorDeclaration("background", legacyBackground));
            roles.add("background");
        }

        if (
            legacyForeground &&
            isSimpleColor(legacyForeground) &&
            !hasComplexBackground &&
            !roles.has("foreground")
        ) {
            adaptedDeclarations.push(lightColorDeclaration("foreground", legacyForeground));
            roles.add("foreground");
        }

        return {
            style: serializeDeclarations(adaptedDeclarations),
            roles: Array.from(roles)
        };
    }

    function adaptStyleText(style) {
        return adaptAuthoredValues(style);
    }

    function darkModeCSS() {
        const foreground = "oklch(from var(--bettercanvas-authored-foreground-light) max(l, 0.88) calc(c * 0.85) h / alpha)";
        const background = "oklch(from var(--bettercanvas-authored-background-light) clamp(0.19, calc(l * 0.3), 0.34) calc(c * 0.7) h / alpha)";
        const border = role => `oklch(from var(--bettercanvas-authored-${role}-light) clamp(0.28, calc(l * 0.5), 0.5) calc(c * 0.65) h / alpha)`;
        // BetterCanvas's legacy theme stylesheet contains high-specificity
        // !important rules. The impossible :not() ID keeps explicit authored
        // colors above those rules without widening the content-only scope.
        const selector = role => `:root [data-bettercanvas-adaptive-colors].bettercanvas-adaptive-${role}:not(#bettercanvas-theme-color)`;
        let css = `${selector("foreground")}{--bettercanvas-authored-foreground:${foreground};color:var(--bettercanvas-authored-foreground)!important}`;
        css += `${selector("background")}{--bettercanvas-authored-background:${background};background-color:var(--bettercanvas-authored-background)!important}`;
        const borderProperties = {
            "border": "border-color",
            "border-top": "border-top-color",
            "border-right": "border-right-color",
            "border-bottom": "border-bottom-color",
            "border-left": "border-left-color"
        };
        Object.keys(borderProperties).forEach(role => {
            css += `${selector(role)}{--bettercanvas-authored-${role}:${border(role)};${borderProperties[role]}:var(--bettercanvas-authored-${role})!important}`;
        });
        return css;
    }

    function lightColorDeclaration(role, lightColor) {
        return {
            property: "--bettercanvas-authored-" + role + "-light",
            value: lightColor,
            important: false
        };
    }

    function isComplexBackgroundDeclaration(declaration) {
        if (declaration.property === "background-image") {
            return declaration.value.trim().toLowerCase() !== "none";
        }
        return declaration.property === "background" && !isSimpleColor(declaration.value);
    }

    function findAdaptiveColor(property, value) {
        if (property === "background") {
            return isSimpleColor(value)
                ? { lightColor: value, adaptedValue: "var(--bettercanvas-authored-background)" }
                : null;
        }

        if (borderShorthands.has(property)) {
            const color = findLastSimpleColor(splitCss(value, " "));
            if (!color) return null;
            const role = adaptiveProperties[property];
            return {
                lightColor: color,
                adaptedValue: replaceLast(value, color, "var(--bettercanvas-authored-" + role + ")")
            };
        }

        const role = adaptiveProperties[property];
        return isSimpleColor(value)
            ? { lightColor: value, adaptedValue: "var(--bettercanvas-authored-" + role + ")" }
            : null;
    }

    function parseDeclarations(style) {
        return splitCss(style, ";").reduce((declarations, part) => {
            const colon = findTopLevelCharacter(part, ":");
            if (colon < 0) return declarations;

            const property = part.slice(0, colon).trim().toLowerCase();
            const rawValue = part.slice(colon + 1).trim();
            if (!property || !rawValue) return declarations;

            const important = /\s*!important\s*$/i.test(rawValue);
            const value = important
                ? rawValue.replace(/\s*!important\s*$/i, "").trim()
                : rawValue;
            declarations.push({ property, value, important });
            return declarations;
        }, []);
    }

    function serializeDeclarations(declarations) {
        return declarations.map(declaration =>
            declaration.property + ": " + declaration.value +
            (declaration.important ? " !important" : "")
        ).join("; ");
    }

    function isSimpleColor(value) {
        const normalized = value.trim().toLowerCase();
        if (nonColorKeywords.has(normalized)) return false;
        if (/^#[\da-f]{3,8}$/i.test(normalized)) return true;
        if (/^[a-z]+$/i.test(normalized)) return true;
        return /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([^;]+\)$/i.test(normalized);
    }

    function findLastSimpleColor(parts) {
        for (let index = parts.length - 1; index >= 0; index--) {
            const part = parts[index].trim();
            if (part && isSimpleColor(part)) return part;
        }
        return null;
    }

    function replaceLast(value, search, replacement) {
        const index = value.lastIndexOf(search);
        return index < 0
            ? value
            : value.slice(0, index) + replacement + value.slice(index + search.length);
    }

    function splitCss(value, separator) {
        const parts = [];
        let start = 0;
        let depth = 0;
        let quote;

        for (let index = 0; index < value.length; index++) {
            const character = value[index];
            if (quote) {
                if (character === quote && value[index - 1] !== "\\") quote = null;
                continue;
            }
            if (character === "\"" || character === "'") {
                quote = character;
                continue;
            }
            if (character === "(") depth++;
            if (character === ")") depth = Math.max(0, depth - 1);
            if (character === separator && depth === 0) {
                parts.push(value.slice(start, index));
                start = index + 1;
            }
        }
        parts.push(value.slice(start));
        return parts;
    }

    function findTopLevelCharacter(value, target) {
        let depth = 0;
        let quote;

        for (let index = 0; index < value.length; index++) {
            const character = value[index];
            if (quote) {
                if (character === quote && value[index - 1] !== "\\") quote = null;
                continue;
            }
            if (character === "\"" || character === "'") {
                quote = character;
                continue;
            }
            if (character === "(") depth++;
            if (character === ")") depth = Math.max(0, depth - 1);
            if (character === target && depth === 0) return index;
        }
        return -1;
    }

    return {
        adaptAuthoredColors,
        adaptAuthoredValues,
        adaptStyleText,
        darkModeCSS,
        observeDocument,
        parseDeclarations
    };
});
