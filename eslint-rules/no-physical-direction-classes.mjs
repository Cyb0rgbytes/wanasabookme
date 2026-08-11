/**
 * Bans Tailwind physical-direction utilities in favour of logical ones.
 *
 * WHY: This app ships Arabic (RTL) as a first-class language. A class like
 * `ml-4` means "margin-left" in both directions, so an RTL layout silently
 * gains spacing on the wrong side. `ms-4` means "margin-inline-start", which
 * flips correctly. Physical classes are how RTL support rots one PR at a time.
 *
 * Deliberately NOT banned: `left-*`/`right-*` when used for genuinely physical
 * positioning is still caught here — if you truly need it (rare), use an
 * inline style with a comment explaining why, rather than disabling this rule.
 */

const REPLACEMENTS = {
  ml: "ms",
  mr: "me",
  pl: "ps",
  pr: "pe",
  "border-l": "border-s",
  "border-r": "border-e",
  "rounded-l": "rounded-s",
  "rounded-r": "rounded-e",
  "text-left": "text-start",
  "text-right": "text-end",
  left: "start",
  right: "end",
  "inset-l": "inset-s",
  "inset-r": "inset-e",
  "scroll-ml": "scroll-ms",
  "scroll-mr": "scroll-me",
  "scroll-pl": "scroll-ps",
  "scroll-pr": "scroll-pe",
};

// Matches an optional variant chain (sm:, hover:, dark:) then the utility.
// Examples caught: "ml-4", "sm:pr-2", "-ml-1", "hover:text-left", "left-0".
const PATTERN = new RegExp(
  String.raw`(?:^|\s)(-?)(?:[a-z0-9-]+:)*(` +
    Object.keys(REPLACEMENTS)
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/[-]/g, "\\-"))
      .join("|") +
    String.raw`)(?:-|\b)`,
  "g",
);

/** Utilities that are complete tokens rather than prefixes taking a value. */
const WHOLE_TOKENS = new Set(["text-left", "text-right"]);

function findViolations(value) {
  const found = [];
  for (const match of value.matchAll(PATTERN)) {
    const utility = match[2];
    const suffix = WHOLE_TOKENS.has(utility) ? "" : "-*";
    found.push({
      utility: `${utility}${suffix}`,
      suggestion: `${REPLACEMENTS[utility]}${suffix}`,
    });
  }
  return found;
}

/** Class-bearing JSX attributes worth checking. */
const CLASS_ATTRS = new Set(["className", "class"]);

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Tailwind physical-direction classes; use logical properties so RTL mirrors correctly.",
    },
    schema: [],
    messages: {
      physical:
        "'{{utility}}' is physical and breaks RTL. Use '{{suggestion}}' instead (logical property). See AGENTS.md.",
    },
  },

  create(context) {
    function check(node, value) {
      if (typeof value !== "string") return;
      for (const { utility, suggestion } of findViolations(value)) {
        context.report({
          node,
          messageId: "physical",
          data: { utility, suggestion },
        });
      }
    }

    return {
      JSXAttribute(node) {
        if (!CLASS_ATTRS.has(node.name?.name)) return;

        // Plain string: className="..."
        if (node.value?.type === "Literal") {
          check(node, node.value.value);
        }

        // Expression form, including template literals with interpolation.
        if (node.value?.type === "JSXExpressionContainer") {
          const expr = node.value.expression;
          if (expr.type === "Literal") {
            check(node, expr.value);
          } else if (expr.type === "TemplateLiteral") {
            for (const quasi of expr.quasis) {
              check(node, quasi.value.raw);
            }
          }
        }
      },
    };
  },
};

export default rule;
