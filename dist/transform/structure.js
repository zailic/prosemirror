"use strict";

var _require = require("../model");

var Slice = _require.Slice;
var Fragment = _require.Fragment;

var _require2 = require("./transform");

var Transform = _require2.Transform;

var _require3 = require("./replace_step");

var ReplaceStep = _require3.ReplaceStep;
var ReplaceAroundStep = _require3.ReplaceAroundStep;


function canCut(node, start, end) {
  return (start == 0 || node.canReplace(start, node.childCount)) && (end == node.childCount || node.canReplace(0, start));
}

// :: (NodeRange) → ?number
// Try to find a target depth to which the content in the given range
// can be lifted.
function liftTarget(range) {
  var parent = range.parent;
  var content = parent.content.cutByIndex(range.startIndex, range.endIndex);
  for (var depth = range.depth;; --depth) {
    var node = range.$from.node(depth),
        index = range.$from.index(depth),
        endIndex = range.$to.indexAfter(depth);
    if (depth < range.depth && node.canReplace(index, endIndex, content)) return depth;
    if (depth == 0 || !canCut(node, index, endIndex)) break;
  }
}
exports.liftTarget = liftTarget;

// :: (NodeRange, number) → Transform
// Split the content in the given range off from its parent, if there
// is subling content before or after it, and move it up the tree to
// the depth specified by `target`. You'll probably want to use
// `liftTarget` to compute `target`, in order to be sure the lift is
// valid.
Transform.prototype.lift = function (range, target) {
  var $from = range.$from;
  var $to = range.$to;
  var depth = range.depth;


  var gapStart = $from.before(depth + 1),
      gapEnd = $to.after(depth + 1);
  var start = gapStart,
      end = gapEnd;

  var before = Fragment.empty,
      openLeft = 0;
  for (var d = depth, splitting = false; d > target; d--) {
    if (splitting || $from.index(d) > 0) {
      splitting = true;
      before = Fragment.from($from.node(d).copy(before));
      openLeft++;
    } else {
      start--;
    }
  }var after = Fragment.empty,
      openRight = 0;
  for (var _d = depth, _splitting = false; _d > target; _d--) {
    if (_splitting || $to.after(_d + 1) < $to.end(_d)) {
      _splitting = true;
      after = Fragment.from($to.node(_d).copy(after));
      openRight++;
    } else {
      end++;
    }
  }return this.step(new ReplaceAroundStep(start, end, gapStart, gapEnd, new Slice(before.append(after), openLeft, openRight), before.size - openLeft, true));
};

// :: (NodeRange, NodeType, ?Object) → ?[{type: NodeType, attrs: ?Object}]
// Try to find a valid way to wrap the content in the given range in a
// node of the given type. May introduce extra nodes around and inside
// the wrapper node, if necessary.
function findWrapping(range, nodeType, attrs) {
  var innerRange = arguments.length <= 3 || arguments[3] === undefined ? range : arguments[3];

  var wrap = { type: nodeType, attrs: attrs };
  var around = findWrappingOutside(range, wrap);
  var inner = around && findWrappingInside(innerRange, wrap);
  if (!inner) return null;
  return around.concat(wrap).concat(inner);
}
exports.findWrapping = findWrapping;

function findWrappingOutside(range, wrap) {
  var parent = range.parent;
  var startIndex = range.startIndex;
  var endIndex = range.endIndex;

  var around = parent.contentMatchAt(startIndex).findWrapping(wrap.type, wrap.attrs);
  if (!around) return null;
  var outer = around.length ? around[0] : wrap;
  if (!parent.canReplaceWith(startIndex, endIndex, outer.type, outer.attrs)) return null;
  return around;
}

function findWrappingInside(range, wrap) {
  var parent = range.parent;
  var startIndex = range.startIndex;
  var endIndex = range.endIndex;

  var inner = parent.child(startIndex);
  var inside = wrap.type.contentExpr.start(wrap.attrs).findWrapping(inner.type, inner.attrs);
  if (!inside) return null;
  var last = inside.length ? inside[inside.length - 1] : wrap;
  var innerMatch = last.type.contentExpr.start(last.attrs);
  for (var i = startIndex; i < endIndex; i++) {
    innerMatch = innerMatch && innerMatch.matchNode(parent.child(i));
  }if (!innerMatch || !innerMatch.validEnd()) return null;
  return inside;
}

// :: (NodeRange, [{type: NodeType, attrs: ?Object}]) → Transform
// Wrap the given [range](#NodeRange) in the given set of wrappers.
// The wrappers are assumed to be valid in this position, and should
// probably be computed with `findWrapping`.
Transform.prototype.wrap = function (range, wrappers) {
  var content = Fragment.empty;
  for (var i = wrappers.length - 1; i >= 0; i--) {
    content = Fragment.from(wrappers[i].type.create(wrappers[i].attrs, content));
  }var start = range.start,
      end = range.end;
  return this.step(new ReplaceAroundStep(start, end, start, end, new Slice(content, 0, 0), wrappers.length, true));
};

// :: (number, ?number, NodeType, ?Object) → Transform
// Set the type of all textblocks (partly) between `from` and `to` to
// the given node type with the given attributes.
Transform.prototype.setBlockType = function (from) {
  var to = arguments.length <= 1 || arguments[1] === undefined ? from : arguments[1];

  var _this = this;

  var type = arguments[2];
  var attrs = arguments[3];

  if (!type.isTextblock) throw new RangeError("Type given to setBlockType should be a textblock");
  var mapFrom = this.steps.length;
  this.doc.nodesBetween(from, to, function (node, pos) {
    if (node.isTextblock && !node.hasMarkup(type, attrs)) {
      // Ensure all markup that isn't allowed in the new node type is cleared
      _this.clearMarkupFor(_this.map(pos, 1, mapFrom), type, attrs);
      var startM = _this.map(pos, 1, mapFrom),
          endM = _this.map(pos + node.nodeSize, 1, mapFrom);
      _this.step(new ReplaceAroundStep(startM, endM, startM + 1, endM - 1, new Slice(Fragment.from(type.create(attrs)), 0, 0), 1, true));
      return false;
    }
  });
  return this;
};

// :: (number, ?NodeType, ?Object) → Transform
// Change the type and attributes of the node after `pos`.
Transform.prototype.setNodeType = function (pos, type, attrs) {
  var node = this.doc.nodeAt(pos);
  if (!node) throw new RangeError("No node at given position");
  if (!type) type = node.type;
  if (node.type.isLeaf) return this.replaceWith(pos, pos + node.nodeSize, type.create(attrs, null, node.marks));

  if (!type.validContent(node.content, attrs)) throw new RangeError("Invalid content for node type " + type.name);

  return this.step(new ReplaceAroundStep(pos, pos + node.nodeSize, pos + 1, pos + node.nodeSize - 1, new Slice(Fragment.from(type.create(attrs)), 0, 0), 1, true));
};

// :: (Node, number, ?NodeType, ?Object) → bool
// Check whether splitting at the given position is allowed.
function canSplit(doc, pos) {
  var depth = arguments.length <= 2 || arguments[2] === undefined ? 1 : arguments[2];
  var typeAfter = arguments[3];
  var attrsAfter = arguments[4];

  var $pos = doc.resolve(pos),
      base = $pos.depth - depth;
  if (base < 0 || !$pos.parent.canReplace($pos.index(), $pos.parent.childCount) || !$pos.parent.canReplace(0, $pos.indexAfter())) return false;
  for (var d = $pos.depth - 1; d > base; d--) {
    var node = $pos.node(d),
        _index = $pos.index(d);
    if (!node.canReplace(0, _index) || !node.canReplaceWith(_index, node.childCount, typeAfter || $pos.node(d + 1).type, typeAfter ? attrsAfter : $pos.node(d + 1).attrs)) return false;
    typeAfter = null;
  }
  var index = $pos.indexAfter(base);
  return $pos.node(base).canReplaceWith(index, index, typeAfter || $pos.node(base + 1).type, typeAfter ? attrsAfter : $pos.node(base + 1).attrs);
}
exports.canSplit = canSplit;

// :: (number, ?number, ?NodeType, ?Object) → Transform
// Split the node at the given position, and optionally, if `depth` is
// greater than one, any number of nodes above that. By default, the part
// split off will inherit the node type of the original node. This can
// be changed by passing `typeAfter` and `attrsAfter`.
Transform.prototype.split = function (pos) {
  var depth = arguments.length <= 1 || arguments[1] === undefined ? 1 : arguments[1];
  var typeAfter = arguments[2];
  var attrsAfter = arguments[3];

  var $pos = this.doc.resolve(pos),
      before = Fragment.empty,
      after = Fragment.empty;
  for (var d = $pos.depth, e = $pos.depth - depth; d > e; d--) {
    before = Fragment.from($pos.node(d).copy(before));
    after = Fragment.from(typeAfter ? typeAfter.create(attrsAfter, after) : $pos.node(d).copy(after));
    typeAfter = null;
  }
  return this.step(new ReplaceStep(pos, pos, new Slice(before.append(after), depth, depth, true)));
};

// :: (Node, number) → bool
// Test whether the blocks before and after a given position can be
// joined.
function joinable(doc, pos) {
  var $pos = doc.resolve(pos),
      index = $pos.index();
  return canJoin($pos.nodeBefore, $pos.nodeAfter) && $pos.parent.canReplace(index, index + 1);
}
exports.joinable = joinable;

function canJoin(a, b) {
  return a && b && !a.isText && a.canAppend(b);
}

// :: (Node, number, ?number) → ?number
// Find an ancestor of the given position that can be joined to the
// block before (or after if `dir` is positive). Returns the joinable
// point, if any.
function joinPoint(doc, pos) {
  var dir = arguments.length <= 2 || arguments[2] === undefined ? -1 : arguments[2];

  var $pos = doc.resolve(pos);
  for (var d = $pos.depth;; d--) {
    var before = void 0,
        after = void 0;
    if (d == $pos.depth) {
      before = $pos.nodeBefore;
      after = $pos.nodeAfter;
    } else if (dir > 0) {
      before = $pos.node(d + 1);
      after = $pos.node(d).maybeChild($pos.index(d) + 1);
    } else {
      before = $pos.node(d).maybeChild($pos.index(d) - 1);
      after = $pos.node(d + 1);
    }
    if (before && !before.isTextblock && canJoin(before, after)) return pos;
    if (d == 0) break;
    pos = dir < 0 ? $pos.before(d) : $pos.after(d);
  }
}
exports.joinPoint = joinPoint;

// :: (number, ?number, ?bool) → Transform
// Join the blocks around the given position. When `silent` is true,
// the method will return without raising an error if the position
// isn't a valid place to join.
Transform.prototype.join = function (pos) {
  var depth = arguments.length <= 1 || arguments[1] === undefined ? 1 : arguments[1];
  var silent = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

  if (silent && (pos < depth || pos + depth > this.doc.content.size)) return this;
  var step = new ReplaceStep(pos - depth, pos + depth, Slice.empty, true);
  if (silent) this.maybeStep(step);else this.step(step);
  return this;
};

// :: (Node, number, NodeType, ?Object) → ?number
// Try to find a point where a node of the given type can be inserted
// near `pos`, by searching up the node hierarchy when `pos` itself
// isn't a valid place but is at the start or end of a node. Return
// null if no position was found.
function insertPoint(doc, pos, nodeType, attrs) {
  var $pos = doc.resolve(pos);
  if ($pos.parent.canReplaceWith($pos.index(), $pos.index(), nodeType, attrs)) return pos;

  if ($pos.parentOffset == 0) for (var d = $pos.depth - 1; d >= 0; d--) {
    var index = $pos.index(d);
    if ($pos.node(d).canReplaceWith(index, index, nodeType, attrs)) return $pos.before(d + 1);
    if (index > 0) return null;
  }
  if ($pos.parentOffset == $pos.parent.content.size) for (var _d2 = $pos.depth - 1; _d2 >= 0; _d2--) {
    var _index2 = $pos.indexAfter(_d2);
    if ($pos.node(_d2).canReplaceWith(_index2, _index2, nodeType, attrs)) return $pos.after(_d2 + 1);
    if (_index2 < $pos.node(_d2).childCount) return null;
  }
}
exports.insertPoint = insertPoint;