"use strict";

var _require = require("../model");

var Mark = _require.Mark;

var _require2 = require("../schema-basic");

var schema = _require2.schema;

var _require3 = require("./failure");

var Failure = _require3.Failure;

var _require4 = require("./tests");

var defTest = _require4.defTest;

var _require5 = require("./build");

var doc = _require5.doc;
var p = _require5.p;
var em = _require5.em;
var a = _require5.a;


function assert(name, value) {
    if (!value) throw new Failure("Assertion failed: " + name);
}

var em_ = schema.mark("em");
var strong = schema.mark("strong");
var link = function link(href, title) {
    return schema.mark("link", { href: href, title: title });
};
var code = schema.mark("code");

defTest("mark_same", function () {
    assert("empty", Mark.sameSet([], []));
    assert("two", Mark.sameSet([em_, strong], [em_, strong]));
    assert("diff set", !Mark.sameSet([em_, strong], [em_, code]));
    assert("diff size", !Mark.sameSet([em_, strong], [em_, strong, code]));
    assert("links", link("http://foo").eq(link("http://foo")));
    assert("diff links", !link("http://foo").eq(link("http://bar")));
    assert("diff title", !link("http://foo", "A").eq(link("http://foo", "B")));
    assert("link in set", Mark.sameSet([link("http://foo"), code], [link("http://foo"), code]));
    assert("diff link in set", !Mark.sameSet([link("http://foo"), code], [link("http://bar"), code]));
});

defTest("mark_add", function () {
    assert("from empty", em_.addToSet([]), [em_]);
    assert("duplicate", em_.addToSet([em_]), [em_]);
    assert("at start", em_.addToSet([strong]), [em_, strong]);
    assert("at end", strong.addToSet([em_]), [em_, strong]);
    assert("replace link", link("http://bar").addToSet([em_, link("http://foo")]), [em_, link("http://bar")]);
    assert("same link", link("http://foo").addToSet([em_, link("http://foo")]), [em_, link("http://foo")]);
    assert("code at end", code.addToSet([em_, strong, link("http://foo")]), [em_, strong, link("http://foo"), code]);
    assert("strong in middle", strong.addToSet([em_, code]), [em_, strong, code]);
});

defTest("mark_remove", function () {
    assert("empty", em_.removeFromSet([]), []);
    assert("single", em_.removeFromSet([em_]), []), assert("not in set", strong.removeFromSet([em_]), [em_]);
    assert("link", link("http://foo").removeFromSet([link("http://foo")]), []);
    assert("different link", link("http://foo", "title").removeFromSet([link("http://foo")]), [link("http://foo")]);
});

function has(name, doc, mark, result) {
    defTest("has_mark_" + name, function () {
        if (mark.isInSet(doc.marksAt(doc.tag.a)) != result) throw new Failure("hasMark(" + doc + ", " + doc.tag.a + ", " + mark.type.name + ") returned " + !result);
    });
}

has("simple", doc(p(em("fo<a>o"))), em_, true);
has("simple_not", doc(p(em("fo<a>o"))), strong, false);
has("after", doc(p(em("hi"), "<a> there")), em_, true);
has("before", doc(p("one <a>", em("two"))), em_, false);
has("start", doc(p(em("<a>one"))), em_, true);
has("different_link", doc(p(a("li<a>nk"))), link("http://baz"), false);