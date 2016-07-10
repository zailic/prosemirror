"use strict";

var _require = require("./build");

var doc = _require.doc;
var blockquote = _require.blockquote;
var h1 = _require.h1;
var h2 = _require.h2;
var p = _require.p;
var hr = _require.hr;
var li = _require.li;
var ol = _require.ol;
var ul = _require.ul;
var em = _require.em;
var strong = _require.strong;
var code = _require.code;
var a = _require.a;
var br = _require.br;
var img = _require.img;
var dataImage = _require.dataImage;

var _require2 = require("./cmp");

var cmpNode = _require2.cmpNode;
var cmpStr = _require2.cmpStr;

var _require3 = require("./tests");

var defTest = _require3.defTest;

var _require4 = require("../markdown");

var defaultMarkdownParser = _require4.defaultMarkdownParser;
var defaultMarkdownSerializer = _require4.defaultMarkdownSerializer;


function t(name, text, doc) {
  defTest("parse_" + name, function () {
    cmpNode(defaultMarkdownParser.parse(text), doc);
    cmpStr(defaultMarkdownSerializer.serialize(doc), text);
  });
}

t("paragraph", "hello!", doc(p("hello!")));

t("heading", "# one\n\n## two\n\nthree", doc(h1("one"), h2("two"), p("three")));

t("quote", "> once\n\n> > twice", doc(blockquote(p("once")), blockquote(blockquote(p("twice")))));

// FIXME bring back testing for preserving bullets and tight attrs
// when supported again

t("bullet_list", "* foo\n\n  * bar\n\n  * baz\n\n* quux", doc(ul(li(p("foo"), ul(li(p("bar")), li(p("baz")))), li(p("quux")))));

t("ordered_list", "1. Hello\n\n2. Goodbye\n\n3. Nest\n\n   1. Hey\n\n   2. Aye", doc(ol(li(p("Hello")), li(p("Goodbye")), li(p("Nest"), ol(li(p("Hey")), li(p("Aye")))))));

/* FIXME disabled until we have markdown attributes
t("code_block",
  "```\nMy Code\n```\n\n    Other code\n\nPara",
  doc(pre2("My Code"), pre("Other code"), p("Para")))*/

t("inline", "Hello. Some *em* text, some **strong** text, and some `code`", doc(p("Hello. Some ", em("em"), " text, some ", strong("strong"), " text, and some ", code("code"))));

t("inline_overlap_mix", "This is **strong *emphasized text with `code` in* it**", doc(p("This is ", strong("strong ", em("emphasized text with ", code("code"), " in"), " it"))));

t("inline_overlap_link", "**[link](http://foo) is bold**", doc(p(strong(a("link"), " is bold"))));

t("inline_overlap_code", "**`code` is bold**", doc(p(strong(code("code"), " is bold"))));

t("link", "My [link](http://foo) goes to foo", doc(p("My ", a("link"), " goes to foo")));

t("image", "Here's an image: ![x](" + dataImage + ")", doc(p("Here's an image: ", img)));

t("break", "line one\\\nline two", doc(p("line one", br, "line two")));

t("horizontal_rule", "one two\n\n---\n\nthree", doc(p("one two"), hr, p("three")));

t("ignore_html", "Foo < img> bar", doc(p("Foo < img> bar")));

t("not_a_list", "1\\. foo", doc(p("1. foo")));