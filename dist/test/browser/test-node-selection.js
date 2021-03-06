"use strict";

var _require = require("./def");

var namespace = _require.namespace;
var dispatch = _require.dispatch;

var _require2 = require("../build");

var doc = _require2.doc;
var blockquote = _require2.blockquote;
var pre = _require2.pre;
var p = _require2.p;
var li = _require2.li;
var ul = _require2.ul;
var img = _require2.img;
var br = _require2.br;
var hr = _require2.hr;

var _require3 = require("../cmp");

var cmp = _require3.cmp;
var cmpStr = _require3.cmpStr;
var cmpNode = _require3.cmpNode;
var is = _require3.is;

var _require4 = require("../../commands");

var selectParentNode = _require4.selectParentNode;
var lift = _require4.lift;
var joinDown = _require4.joinDown;
var joinUp = _require4.joinUp;
var deleteSelection = _require4.deleteSelection;


var test = namespace("nodeselection");

test("parent_block", function (pm) {
  pm.setTextSelection(9);
  selectParentNode(pm);
  cmpStr(pm.selection.from, 7, "to paragraph");
  selectParentNode(pm);
  cmpStr(pm.selection.from, 1, "to list item");
  selectParentNode(pm);
  cmpStr(pm.selection.from, 0, "to list");
  selectParentNode(pm);
  cmpStr(pm.selection.from, 0, "stop at toplevel");
}, { doc: doc(ul(li(p("foo"), p("bar")), li(p("baz")))) });

test("through_inline_node", function (pm) {
  pm.setTextSelection(4);
  dispatch(pm, "Right");
  cmpStr(pm.selection.from, 4, "moved right onto image");
  dispatch(pm, "Right");
  cmpStr(pm.selection.head, 5, "moved right past");
  cmpStr(pm.selection.anchor, 5, "moved right past'");
  dispatch(pm, "Left");
  cmpStr(pm.selection.from, 4, "moved left onto image");
  dispatch(pm, "Left");
  cmpStr(pm.selection.head, 4, "moved left past");
  cmpStr(pm.selection.anchor, 4, "moved left past'");
}, { doc: doc(p("foo", img, "bar")) });

test("onto_block", function (pm) {
  pm.setTextSelection(6);
  dispatch(pm, "Down");
  cmpStr(pm.selection.from, 7, "moved down onto hr");
  pm.setTextSelection(11);
  dispatch(pm, "Up");
  cmpStr(pm.selection.from, 7, "moved up onto hr");
}, { doc: doc(p("hello"), hr, ul(li(p("there")))) });

test("through_double_block", function (pm) {
  pm.setTextSelection(7);
  dispatch(pm, "Down");
  cmpStr(pm.selection.from, 9, "moved down onto hr");
  dispatch(pm, "Down");
  cmpStr(pm.selection.from, 10, "moved down onto second hr");
  pm.setTextSelection(14);
  dispatch(pm, "Up");
  cmpStr(pm.selection.from, 10, "moved up onto second hr");
  dispatch(pm, "Up");
  cmpStr(pm.selection.from, 9, "moved up onto hr");
}, { doc: doc(blockquote(p("hello")), hr, hr, p("there")) });

test("horizontally_through_block", function (pm) {
  pm.setTextSelection(4);
  dispatch(pm, "Right");
  cmpStr(pm.selection.from, 5, "right into first hr");
  dispatch(pm, "Right");
  cmpStr(pm.selection.from, 6, "right into second hr");
  dispatch(pm, "Right");
  cmpStr(pm.selection.head, 8, "right out of hr");
  dispatch(pm, "Left");
  cmpStr(pm.selection.from, 6, "left into second hr");
  dispatch(pm, "Left");
  cmpStr(pm.selection.from, 5, "left into first hr");
  dispatch(pm, "Left");
  cmpStr(pm.selection.head, 4, "left out of hr");
}, { doc: doc(p("foo"), hr, hr, p("bar")) });

test("block_out_of_image", function (pm) {
  pm.setNodeSelection(4);
  dispatch(pm, "Down");
  cmpStr(pm.selection.from, 6, "down into hr");
  pm.setNodeSelection(8);
  dispatch(pm, "Up");
  cmpStr(pm.selection.from, 6, "up into hr");
}, { doc: doc(p("foo", img), hr, p(img, "bar")) });

test("lift_preserves", function (pm) {
  pm.setNodeSelection(3);
  lift(pm);
  cmpNode(pm.doc, doc(ul(li(p("hi")))), "lifted");
  cmpStr(pm.selection.from, 2, "preserved selection");
  lift(pm);
  cmpNode(pm.doc, doc(p("hi")), "lifted again");
  cmpStr(pm.selection.from, 0, "preserved selection again");
}, { doc: doc(ul(li(blockquote(p("hi"))))) });

test("lift_at_selection_level", function (pm) {
  pm.setNodeSelection(1);
  lift(pm);
  cmpNode(pm.doc, doc(ul(li(p("a")), li(p("b")))), "lifted list");
  cmpStr(pm.selection.from, 0, "preserved selection");
}, { doc: doc(blockquote(ul(li(p("a")), li(p("b"))))) });

test("join_precisely_down", function (pm) {
  pm.setNodeSelection(1);
  cmp(joinDown(pm), false, "don't join parent");
  pm.setNodeSelection(0);
  joinDown(pm);
  cmpNode(pm.doc, doc(blockquote(p("foo"), p("bar"))), "joined");
  cmpStr(pm.selection.from, 0, "selected joined node");
}, { doc: doc(blockquote(p("foo")), blockquote(p("bar"))) });

test("join_precisely_up", function (pm) {
  pm.setNodeSelection(8);
  cmp(joinUp(pm), false, "don't join parent");
  pm.setNodeSelection(7);
  joinUp(pm);
  cmpNode(pm.doc, doc(blockquote(p("foo"), p("bar"))), "joined");
  cmpStr(pm.selection.from, 0, "selected joined node");
}, { doc: doc(blockquote(p("foo")), blockquote(p("bar"))) });

test("delete_block", function (pm) {
  pm.setNodeSelection(0);
  deleteSelection(pm);
  cmpNode(pm.doc, doc(ul(li(p("bar")), li(p("baz")), li(p("quux")))), "paragraph vanished");
  cmpStr(pm.selection.head, 3, "moved to list");
  pm.setNodeSelection(2);
  deleteSelection(pm);
  cmpNode(pm.doc, doc(ul(li(p("baz")), li(p("quux")))), "delete whole item");
  cmpStr(pm.selection.head, 3, "to next item");
  pm.setNodeSelection(9);
  deleteSelection(pm);
  cmpNode(pm.doc, doc(ul(li(p("baz")))), "delete last item");
  cmpStr(pm.selection.head, 6, "back to paragraph above");
  pm.setNodeSelection(0);
  deleteSelection(pm);
  cmpNode(pm.doc, doc(p()), "delete list");
}, { doc: doc(p("foo"), ul(li(p("bar")), li(p("baz")), li(p("quux")))) });

test("delete_hr", function (pm) {
  pm.setNodeSelection(3);
  deleteSelection(pm);
  cmpNode(pm.doc, doc(p("a"), hr, p("b")), "deleted first hr");
  cmpStr(pm.selection.from, 3, "moved to second hr");
  deleteSelection(pm);
  cmpNode(pm.doc, doc(p("a"), p("b")), "deleted second hr");
  cmpStr(pm.selection.head, 4, "moved to paragraph");
}, { doc: doc(p("a"), hr, hr, p("b")) });

test("delete_selection", function (pm) {
  pm.setNodeSelection(4);
  pm.tr.replaceSelection(null).apply();
  cmpNode(pm.doc, doc(p("foobar"), blockquote(p("hi")), p("ay")), "deleted img");
  cmpStr(pm.selection.head, 4, "cursor at img");
  pm.setNodeSelection(9);
  pm.tr.deleteSelection().apply();
  cmpNode(pm.doc, doc(p("foobar"), p("ay")), "deleted blockquote");
  cmpStr(pm.selection.from, 9, "cursor moved past");
  pm.setNodeSelection(8);
  pm.tr.deleteSelection().apply();
  cmpNode(pm.doc, doc(p("foobar")), "deleted paragraph");
  cmpStr(pm.selection.from, 7, "cursor moved back");
}, { doc: doc(p("foo", img, "bar"), blockquote(p("hi")), p("ay")) });

test("replace_selection_inline", function (pm) {
  pm.setNodeSelection(4);
  pm.tr.replaceSelection(pm.schema.node("hard_break")).apply();
  cmpNode(pm.doc, doc(p("foo", br, "bar", img, "baz")), "replaced with br");
  cmpStr(pm.selection.head, 5, "after inserted node");
  is(pm.selection.empty, "empty selection");
  pm.setNodeSelection(8);
  pm.tr.replaceSelection(pm.schema.text("abc")).apply();
  cmpNode(pm.doc, doc(p("foo", br, "barabcbaz")), "replaced with text");
  cmpStr(pm.selection.head, 11, "after text");
  is(pm.selection.empty, "again empty selection");
  pm.setNodeSelection(0);
  pm.tr.replaceSelection(pm.schema.text("xyz")).apply();
  cmpNode(pm.doc, doc(p("xyz")), "replaced all of paragraph");
}, { doc: doc(p("foo", img, "bar", img, "baz")) });

test("replace_selection_block", function (pm) {
  pm.setNodeSelection(5);
  pm.tr.replaceSelection(pm.schema.node("code_block")).apply();
  cmpNode(pm.doc, doc(p("abc"), pre(), hr, blockquote(p("ow"))), "replace with code block");
  cmpStr(pm.selection.from, 7, "selection after");
  pm.setNodeSelection(8);
  pm.tr.replaceSelection(pm.schema.node("paragraph")).apply();
  cmpNode(pm.doc, doc(p("abc"), pre(), hr, p()), "replace with paragraph");
  cmpStr(pm.selection.from, 9);
}, { doc: doc(p("abc"), hr, hr, blockquote(p("ow"))) });