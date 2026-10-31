// Run from frontend: node --test scripts/verify-exam-content-6-ui-follow-up.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const adminPath = "src/app/(portal)/admin/exam/questions/page.tsx";
const applicantPath = "src/app/(portal)/applicant/exam/page.tsx";
const mcqPath = "src/components/exam-content/applicant-question-renderer.tsx";
const parse = (file) =>
  ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
const admin = parse(adminPath);
const applicant = parse(applicantPath);
const mcq = parse(mcqPath);
function nodes(root, predicate) {
  const found = [];
  function visit(node) {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  }
  visit(root);
  return found;
}
const namedFunction = (file, name) =>
  nodes(
    file,
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  )[0];
const variable = (root, name) =>
  nodes(
    root,
    (node) => ts.isVariableDeclaration(node) && node.name.getText() === name,
  )[0];
const pageFunction = namedFunction(admin, "AdminExamQuestionsPage");
const paginationFunction = namedFunction(admin, "QuestionBankPagination");
assert.ok(
  paginationFunction,
  "Expected the small local shared pagination control",
);

// Execute the actual local control, without loading the API-driven page.
// Existing Button is represented by a native button; no browser interaction is claimed.
const scope = { exports: {}, require, Button: "button" };
const compiled = ts.transpileModule(
  `${paginationFunction.getText(admin)}\nexport { QuestionBankPagination };`,
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;
runInNewContext(compiled, scope);
const Pagination = scope.exports.QuestionBankPagination;

// Evaluate the existing page's actual count/clamp/slice expressions, not copies.
const size = Number(variable(admin, "PAGE_SIZE").initializer.getText(admin));
const slice = nodes(
  pageFunction,
  (node) =>
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "slice" &&
    node.expression.expression.getText(admin) === "questions",
)[0];
assert.ok(slice);
const pageView = new Function(
  "questions",
  "page",
  "PAGE_SIZE",
  `
  const pageCount = ${variable(pageFunction, "pageCount").initializer.getText(admin)};
  const visiblePage = ${variable(pageFunction, "visiblePage").initializer.getText(admin)};
  return { pageCount, visiblePage, questions: ${slice.getText(admin)} };
`,
);
const questions = Object.freeze(
  Array.from({ length: 72 }, (_, index) =>
    Object.freeze({ id: `synthetic-${index + 1}` }),
  ),
);
const render = (page, onPageChange = () => {}, position = "top") =>
  Pagination({ page, pageCount: 9, onPageChange, position });
const buttons = (element) =>
  element.props.children.filter((child) => child?.type === "button");

test("72 questions retain page size 8 and nine pages", () => {
  assert.equal(size, 8);
  const view = pageView(questions, 0, size);
  assert.equal(view.pageCount, 9);
  assert.equal(view.visiblePage, 0);
  assert.equal(view.questions.length, 8);
});

test("first page disables Previous and visibly exposes Next and Page 1 of 9", () => {
  const control = render(0);
  const [previous, next] = buttons(control);
  assert.equal(previous.props.disabled, true);
  assert.equal(next.props.disabled, false);
  assert.equal(previous.props.type, "button");
  assert.equal(next.props.type, "button");
  const markup = renderToStaticMarkup(control);
  assert.match(markup, /Page 1 of 9/);
  assert.match(markup, />Previous<\/button>/);
  assert.match(markup, />Next<\/button>/);
  assert.match(markup, /aria-label="Question bank pagination \(top\)"/);
});

test("middle-page controls enable both directions and call the existing page setter", () => {
  let requested;
  const [previous, next] = buttons(
    render(4, (value) => {
      requested = value;
    }),
  );
  assert.equal(previous.props.disabled, false);
  assert.equal(next.props.disabled, false);
  previous.props.onClick();
  assert.equal(requested, 3);
  next.props.onClick();
  assert.equal(requested, 5);
});

test("final page enables Previous, disables Next and reports Page 9 of 9", () => {
  const control = render(8, () => {}, "bottom");
  const [previous, next] = buttons(control);
  assert.equal(previous.props.disabled, false);
  assert.equal(next.props.disabled, true);
  assert.match(renderToStaticMarkup(control), /Page 9 of 9/);
});

test("every selected page slices the correct synthetic IDs without mutating questions", () => {
  const before = JSON.stringify(questions);
  for (let page = 0; page < 9; page++) {
    assert.deepEqual(
      pageView(questions, page, size).questions.map((q) => q.id),
      Array.from(
        { length: 8 },
        (_, index) => `synthetic-${page * 8 + index + 1}`,
      ),
    );
  }
  assert.equal(JSON.stringify(questions), before);
});

test("the existing clamp still handles a shorter or empty bank", () => {
  const short = pageView(questions.slice(0, 3), 8, size);
  assert.equal(short.pageCount, 1);
  assert.equal(short.visiblePage, 0);
  assert.equal(short.questions.length, 3);
  assert.equal(pageView([], 0, size).pageCount, 1);
});

test("top and bottom controls surround the cards and share visiblePage, pageCount and setPage", () => {
  const controls = nodes(
    pageFunction,
    (node) =>
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText(admin) === "QuestionBankPagination",
  );
  assert.equal(controls.length, 2);
  assert.ok(controls[0].pos < slice.pos);
  assert.ok(controls[1].pos > slice.end);
  controls.forEach((control, index) => {
    const attrs = Object.fromEntries(
      control.attributes.properties.map((attribute) => [
        attribute.name.text,
        attribute.initializer,
      ]),
    );
    assert.equal(attrs.page.expression.getText(admin), "visiblePage");
    assert.equal(attrs.pageCount.expression.getText(admin), "pageCount");
    assert.equal(attrs.onPageChange.expression.getText(admin), "setPage");
    assert.equal(attrs.position.text, index === 0 ? "top" : "bottom");
  });
});

for (const [label, file, field, emphasis] of [
  [
    "Admin question",
    admin,
    "question.questionText",
    "question.questionTextEmphasis",
  ],
  [
    "Applicant MCQ",
    mcq,
    "question.questionText",
    "question.questionTextEmphasis",
  ],
  [
    "Applicant essay",
    applicant,
    "essayQuestion.questionText",
    "essayQuestion.questionTextEmphasis",
  ],
]) {
  test(`${label} uses neutral body text and retains EC7 SemanticText/metadata`, () => {
    const semantic = nodes(
      file,
      (node) =>
        ts.isJsxSelfClosingElement(node) &&
        node.tagName.getText(file) === "SemanticText" &&
        node.attributes.properties.some(
          (attr) =>
            attr.name?.text === "text" &&
            attr.initializer?.expression?.getText(file) === field,
        ),
    )[0];
    assert.ok(semantic);
    const parent = semantic.parent;
    assert.ok(ts.isJsxElement(parent));
    const classAttribute = parent.openingElement.attributes.properties.find(
      (attr) => attr.name?.text === "className",
    );
    assert.ok(classAttribute);
    assert.ok(
      classAttribute.initializer.text.includes("text-(--earist-body-text)"),
    );
    assert.ok(
      !classAttribute.initializer.text.includes("text-(--earist-primary)"),
    );
    const marks = semantic.attributes.properties.find(
      (attr) => attr.name?.text === "emphasis",
    );
    assert.equal(marks.initializer.expression.getText(file), emphasis);
  });
}

test("intentional branding, selected-option styling and focus accents remain red", () => {
  const heading = nodes(
    admin,
    (node) =>
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(admin) === "h1",
  )[0];
  assert.match(
    heading.openingElement.getText(admin),
    /text-\(--earist-primary\)/,
  );
  const mcqSource = mcq.getFullText();
  assert.match(
    mcqSource,
    /option\.selected\s*\?\s*"[^"]*text-\(--earist-primary\)/,
  );
  assert.match(mcqSource, /focus-visible:outline-\(--earist-primary\)/);
});
