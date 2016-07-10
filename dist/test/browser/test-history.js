"use strict";

var _require = require("./def");

var namespace = _require.namespace;
var dispatch = _require.dispatch;

var _require2 = require("../build");

var doc = _require2.doc;
var p = _require2.p;
var ul = _require2.ul;
var li = _require2.li;

var _require3 = require("../cmp");

var is = _require3.is;
var cmp = _require3.cmp;
var cmpStr = _require3.cmpStr;
var cmpNode = _require3.cmpNode;

var _require4 = require("../../history");

var historyPlugin = _require4.historyPlugin;

var _require5 = require("../../commands-list");

var sinkListItem = _require5.sinkListItem;
var liftListItem = _require5.liftListItem;
var splitListItem = _require5.splitListItem;


var test = namespace("history", {
  plugins: [historyPlugin]
});

function type(pm, text) {
  pm.tr.replaceSelection(pm.schema.text(text)).apply();
}

test("undo", function (pm) {
  type(pm, "a");
  type(pm, "b");
  cmpNode(pm.doc, doc(p("ab")));
  pm.history.undo();
  cmpNode(pm.doc, doc(p()));
});

test("redo", function (pm) {
  type(pm, "a");
  type(pm, "b");
  pm.history.undo();
  cmpNode(pm.doc, doc(p()));
  pm.history.redo();
  cmpNode(pm.doc, doc(p("ab")));
});

test("multiple", function (pm) {
  type(pm, "a");
  pm.history.cut();
  type(pm, "b");
  cmpNode(pm.doc, doc(p("ab")));
  pm.history.undo();
  cmpNode(pm.doc, doc(p("a")));
  pm.history.undo();
  cmpNode(pm.doc, doc(p()));
  pm.history.redo();
  cmpNode(pm.doc, doc(p("a")));
  pm.history.redo();
  cmpNode(pm.doc, doc(p("ab")));
  pm.history.undo();
  cmpNode(pm.doc, doc(p("a")));
});

test("unsynced", function (pm) {
  type(pm, "hello");
  pm.tr.insertText(1, "oops").apply({ addToHistory: false });
  pm.tr.insertText(10, "!").apply({ addToHistory: false });
  pm.history.undo();
  cmpNode(pm.doc, doc(p("oops!")));
});

function unsyncedComplex(pm, compress) {
  type(pm, "hello");
  pm.history.cut();
  type(pm, "!");
  pm.tr.insertText(1, "....").apply({ addToHistory: false });
  pm.tr.split(3).apply();
  cmpNode(pm.doc, doc(p(".."), p("..hello!")));
  pm.tr.split(2).apply({ addToHistory: false });
  if (compress) pm.history.done.compress(Infinity);
  pm.history.undo();
  cmpNode(pm.doc, doc(p("."), p("...hello")));
  pm.history.undo();
  cmpNode(pm.doc, doc(p("."), p("...")));
}

test("unsynced_complex", function (pm) {
  return unsyncedComplex(pm, false);
});

test("unsynced_complex_compress", function (pm) {
  return unsyncedComplex(pm, true);
});

test("overlapping", function (pm) {
  type(pm, "hello");
  pm.history.cut();
  pm.tr.delete(1, 6).apply();
  cmpNode(pm.doc, doc(p()));
  pm.history.undo();
  cmpNode(pm.doc, doc(p("hello")));
  pm.history.undo();
  cmpNode(pm.doc, doc(p()));
});

test("overlapping_no_collapse", function (pm) {
  pm.history.allowCollapsing = false;
  type(pm, "hello");
  pm.history.cut();
  pm.tr.delete(1, 6).apply();
  cmpNode(pm.doc, doc(p()));
  pm.history.undo();
  cmpNode(pm.doc, doc(p("hello")));
  pm.history.undo();
  cmpNode(pm.doc, doc(p()));
});

test("overlapping_unsynced_delete", function (pm) {
  type(pm, "hi");
  pm.history.cut();
  type(pm, "hello");
  pm.tr.delete(1, 8).apply({ addToHistory: false });
  cmpNode(pm.doc, doc(p()));
  pm.history.undo();
  cmpNode(pm.doc, doc(p()));
});

test("ping_pong", function (pm) {
  type(pm, "one");
  type(pm, " two");
  pm.history.cut();
  type(pm, " three");
  pm.tr.insertText(1, "zero ").apply();
  pm.history.cut();
  pm.tr.split(1).apply();
  pm.setTextSelection(1);
  type(pm, "top");
  for (var i = 0; i < 6; i++) {
    var re = i % 2;
    for (var j = 0; j < 4; j++) {
      cmp(pm.history[re ? "redo" : "undo"](), j < 3);
    }cmpNode(pm.doc, re ? doc(p("top"), p("zero one two three")) : doc(p()));
  }
});

test("eat_neighboring", function (pm) {
  type(pm, "o");
  pm.tr.split(1).apply();
  pm.tr.insertText(3, "zzz").apply({ addToHistory: false });
  pm.history.undo();
  cmpNode(pm.doc, doc(p("zzz")));
});

test("ping_pong_unsynced", function (pm) {
  type(pm, "one");
  type(pm, " two");
  pm.history.cut();
  pm.tr.insertText(pm.selection.head, "xxx").apply({ addToHistory: false });
  type(pm, " three");
  pm.tr.insertText(1, "zero ").apply();
  pm.history.cut();
  pm.tr.split(1).apply();
  pm.setTextSelection(1);
  type(pm, "top");
  pm.tr.insertText(1, "yyy").apply({ addToHistory: false });
  pm.tr.insertText(7, "zzz").apply({ addToHistory: false });
  for (var i = 0; i < 3; i++) {
    if (i == 2) pm.history.done.compress(Infinity);
    for (var j = 0; j < 4; j++) {
      cmp(pm.history.undo(), j < 3);
    }cmpNode(pm.doc, doc(p("yyyzzzxxx")), i + " undo");
    if (i == 2) pm.history.undone.compress(Infinity);
    for (var _j = 0; _j < 4; _j++) {
      cmp(pm.history.redo(), _j < 3);
    }cmpNode(pm.doc, doc(p("yyytopzzz"), p("zero one twoxxx three")), i + " redo");
  }
});

test("setDocResets", function (pm) {
  type(pm, "hello");
  pm.setDoc(doc(p("aah")));
  cmp(pm.history.undo(), false);
  cmpNode(pm.doc, doc(p("aah")));
}, { doc: doc(p("okay")) });

test("isAtVersion", function (pm) {
  type(pm, "hello");
  pm.history.cut();
  var version = pm.history.getVersion();
  type(pm, "ok");
  is(!pm.history.isAtVersion(version), "ahead");
  pm.history.undo();
  is(pm.history.isAtVersion(version), "went back");
  pm.history.undo();
  is(!pm.history.isAtVersion(version), "behind");
  pm.history.redo();
  is(pm.history.isAtVersion(version), "went forward");
});

test("rollback", function (pm) {
  type(pm, "hello");
  var version = pm.history.getVersion();
  type(pm, "ok");
  pm.history.cut();
  type(pm, "more");
  is(pm.history.backToVersion(version), "rollback");
  cmpNode(pm.doc, doc(p("hello")), "back to start");
  is(pm.history.backToVersion(version), "no-op rollback");
  cmpNode(pm.doc, doc(p("hello")), "no-op had no effect");
  pm.history.undo();
  is(!pm.history.backToVersion(version), "failed rollback");
});

test("rollback_to_start", function (pm) {
  var version = pm.history.getVersion();
  type(pm, "def");
  pm.history.backToVersion(version);
  cmpNode(pm.doc, doc(p("abc")));
}, { doc: doc(p("abc")) });

test("setSelectionOnUndo", function (pm) {
  type(pm, "hi");
  pm.history.cut();
  pm.setTextSelection(1, 3);
  var selection = pm.selection;
  pm.tr.replaceWith(selection.from, selection.to, pm.schema.text("hello")).apply();
  var selection2 = pm.selection;
  pm.history.undo();
  is(pm.selection.eq(selection), "failed restoring selection after undo");
  pm.history.redo();
  is(pm.selection.eq(selection2), "failed restoring selection after redo");
});

test("rebaseSelectionOnUndo", function (pm) {
  type(pm, "hi");
  pm.history.cut();
  pm.setTextSelection(1, 3);
  pm.tr.insert(1, pm.schema.text("hello")).apply();
  pm.tr.insert(1, pm.schema.text("---")).apply({ addToHistory: false });
  pm.history.undo();
  cmpStr(pm.selection.head, 6);
});

test("unsynced_overwrite", function (pm) {
  pm.history.preserveItems++;
  type(pm, "a");
  type(pm, "b");
  pm.history.cut();
  pm.setTextSelection(1, 3);
  type(pm, "c");
  pm.history.undo();
  pm.history.undo();
  cmpNode(pm.doc, doc(p()));
});

test("unsynced_list_manip", function (pm) {
  pm.history.preserveItems++;
  splitListItem(pm.schema.nodes.list_item)(pm);
  sinkListItem(pm.schema.nodes.list_item)(pm);
  type(pm, "abc");
  pm.history.cut();
  splitListItem(pm.schema.nodes.list_item)(pm);
  dispatch(pm, "Enter");
  cmpNode(pm.doc, doc(ul(li(p("hello"), ul(li(p("abc"))), p()))));
  pm.history.undo();
  cmpNode(pm.doc, doc(ul(li(p("hello"), ul(li(p("abc")))))));
  pm.history.undo();
  cmpNode(pm.doc, doc(ul(li(p("hello")))));
}, { doc: doc(ul(li(p("hello<a>")))) });

test("unsynced_list_indent", function (pm) {
  pm.history.preserveItems++;
  splitListItem(pm.schema.nodes.list_item)(pm);
  sinkListItem(pm.schema.nodes.list_item)(pm);
  type(pm, "abc");
  pm.history.cut();
  splitListItem(pm.schema.nodes.list_item)(pm);
  sinkListItem(pm.schema.nodes.list_item)(pm);
  type(pm, "def");
  pm.history.cut();
  pm.setTextSelection(12);
  liftListItem(pm.schema.nodes.list_item)(pm);
  cmpNode(pm.doc, doc(ul(li(p("hello")), li(p("abc"), ul(li(p("def")))))));
  pm.history.undo();
  cmpNode(pm.doc, doc(ul(li(p("hello"), ul(li(p("abc"), ul(li(p("def")))))))));
  pm.history.undo();
  cmpNode(pm.doc, doc(ul(li(p("hello"), ul(li(p("abc")))))));
  pm.history.undo();
  cmpNode(pm.doc, doc(ul(li(p("hello")))));
  pm.history.redo();
  cmpNode(pm.doc, doc(ul(li(p("hello"), ul(li(p("abc")))))));
  pm.history.redo();
  cmpNode(pm.doc, doc(ul(li(p("hello"), ul(li(p("abc"), ul(li(p("def")))))))));
  pm.history.redo();
  cmpNode(pm.doc, doc(ul(li(p("hello")), li(p("abc"), ul(li(p("def")))))));
}, { doc: doc(ul(li(p("hello<a>")))) });

test("nonselective", function (pm) {
  pm.tr.insertText(1, "abc").apply({ addToHistory: false });
  cmpNode(pm.doc, doc(p("abc")));
  pm.history.undo();
  cmpNode(pm.doc, doc(p()));
}, { plugins: [historyPlugin.config({ selective: false })] });