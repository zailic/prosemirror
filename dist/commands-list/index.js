"use strict";

var _require = require("../transform");

var findWrapping = _require.findWrapping;
var liftTarget = _require.liftTarget;
var canSplit = _require.canSplit;
var ReplaceAroundStep = _require.ReplaceAroundStep;

var _require2 = require("../model");

var Slice = _require2.Slice;
var Fragment = _require2.Fragment;
var NodeRange = _require2.NodeRange;

// !! This module exports a number of list-related commands, which
// assume lists to be nestable, but with the restriction that the
// first child of a list item is not a list.

// :: (NodeType, ?Object) → (pm: ProseMirror, apply: ?bool) → bool
// Returns a command function that wraps the selection in a list with
// the given type an attributes. If `apply` is `false`, only return a
// value to indicate whether this is possible, but don't actually
// perform the change.

function wrapInList(nodeType, attrs) {
  return function (pm, apply) {
    var _pm$selection = pm.selection;
    var $from = _pm$selection.$from;
    var $to = _pm$selection.$to;

    var range = $from.blockRange($to),
        doJoin = false,
        outerRange = range;
    // This is at the top of an existing list item
    if (range.depth >= 2 && $from.node(range.depth - 1).type.compatibleContent(nodeType) && range.startIndex == 0) {
      // Don't do anything if this is the top of the list
      if ($from.index(range.depth - 1) == 0) return false;
      var $insert = pm.doc.resolve(range.start - 2);
      outerRange = new NodeRange($insert, $insert, range.depth);
      if (range.endIndex < range.parent.childCount) range = new NodeRange($from, pm.doc.resolve($to.end(range.depth)), range.depth);
      doJoin = true;
    }
    var wrap = findWrapping(outerRange, nodeType, attrs, range);
    if (!wrap) return false;
    if (apply !== false) doWrapInList(pm.tr, range, wrap, doJoin, nodeType).applyAndScroll();
    return true;
  };
}
exports.wrapInList = wrapInList;

function doWrapInList(tr, range, wrappers, joinBefore, nodeType) {
  var content = Fragment.empty;
  for (var i = wrappers.length - 1; i >= 0; i--) {
    content = Fragment.from(wrappers[i].type.create(wrappers[i].attrs, content));
  }tr.step(new ReplaceAroundStep(range.start - (joinBefore ? 2 : 0), range.end, range.start, range.end, new Slice(content, 0, 0), wrappers.length, true));

  var found = 0;
  for (var _i = 0; _i < wrappers.length; _i++) {
    if (wrappers[_i].type == nodeType) found = _i + 1;
  }var splitDepth = wrappers.length - found;

  var splitPos = range.start + wrappers.length - (joinBefore ? 2 : 0),
      parent = range.parent;
  for (var _i2 = range.startIndex, e = range.endIndex, first = true; _i2 < e; _i2++, first = false) {
    if (!first && canSplit(tr.doc, splitPos, splitDepth)) tr.split(splitPos, splitDepth);
    splitPos += parent.child(_i2).nodeSize + (first ? 0 : 2 * splitDepth);
  }
  return tr;
}

// :: (NodeType) → (pm: ProseMirror) → bool
// Build a command that splits a non-empty textblock at the top level
// of a list item by also splitting that list item.
function splitListItem(nodeType) {
  return function (pm) {
    var _pm$selection2 = pm.selection;
    var $from = _pm$selection2.$from;
    var $to = _pm$selection2.$to;
    var node = _pm$selection2.node;

    if (node && node.isBlock || !$from.parent.content.size || $from.depth < 2 || !$from.sameParent($to)) return false;
    var grandParent = $from.node(-1);
    if (grandParent.type != nodeType) return false;
    var nextType = $to.pos == $from.end() ? grandParent.defaultContentType($from.indexAfter(-1)) : null;
    var tr = pm.tr.delete($from.pos, $to.pos);
    if (!canSplit(tr.doc, $from.pos, 2, nextType)) return false;
    tr.split($from.pos, 2, nextType).applyAndScroll();
    return true;
  };
}
exports.splitListItem = splitListItem;

// :: (NodeType) → (pm: ProseMirror, apply: ?bool) → bool
// Create a command to lift the list item around the selection up into
// a wrapping list.
function liftListItem(nodeType) {
  return function (pm, apply) {
    var _pm$selection3 = pm.selection;
    var $from = _pm$selection3.$from;
    var $to = _pm$selection3.$to;

    var range = $from.blockRange($to, function (node) {
      return node.childCount && node.firstChild.type == nodeType;
    });
    if (!range || range.depth < 2 || $from.node(range.depth - 1).type != nodeType) return false;
    if (apply !== false) {
      var tr = pm.tr,
          end = range.end,
          endOfList = $to.end(range.depth);
      if (end < endOfList) {
        // There are siblings after the lifted items, which must become
        // children of the last item
        tr.step(new ReplaceAroundStep(end - 1, endOfList, end, endOfList, new Slice(Fragment.from(nodeType.create(null, range.parent.copy())), 1, 0), 1, true));
        range = new NodeRange(tr.doc.resolveNoCache($from.pos), tr.doc.resolveNoCache(endOfList), range.depth);
      }

      tr.lift(range, liftTarget(range)).applyAndScroll();
    }
    return true;
  };
}
exports.liftListItem = liftListItem;

// :: (NodeType) → (pm: ProseMirror, apply: ?bool) → bool
// Create a command to sink the list item around the selection down
// into an inner list.
function sinkListItem(nodeType) {
  return function (pm, apply) {
    var _pm$selection4 = pm.selection;
    var $from = _pm$selection4.$from;
    var $to = _pm$selection4.$to;

    var range = $from.blockRange($to, function (node) {
      return node.childCount && node.firstChild.type == nodeType;
    });
    if (!range) return false;
    var startIndex = range.startIndex;
    if (startIndex == 0) return false;
    var parent = range.parent,
        nodeBefore = parent.child(startIndex - 1);
    if (nodeBefore.type != nodeType) return false;
    if (apply !== false) {
      var nestedBefore = nodeBefore.lastChild && nodeBefore.lastChild.type == parent.type;
      var inner = Fragment.from(nestedBefore ? nodeType.create() : null);
      var slice = new Slice(Fragment.from(nodeType.create(null, Fragment.from(parent.copy(inner)))), nestedBefore ? 3 : 1, 0);
      var before = range.start,
          after = range.end;
      pm.tr.step(new ReplaceAroundStep(before - (nestedBefore ? 3 : 1), after, before, after, slice, 1, true)).applyAndScroll();
    }
    return true;
  };
}
exports.sinkListItem = sinkListItem;