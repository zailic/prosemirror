"use strict";

var _require = require("../transform");

var joinPoint = _require.joinPoint;
var joinable = _require.joinable;
var findWrapping = _require.findWrapping;
var liftTarget = _require.liftTarget;
var canSplit = _require.canSplit;
var ReplaceAroundStep = _require.ReplaceAroundStep;

var _require2 = require("../model");

var Slice = _require2.Slice;
var Fragment = _require2.Fragment;

var browser = require("../util/browser");
var Keymap = require("browserkeymap");

var _require3 = require("../util/char");

var charCategory = _require3.charCategory;
var isExtendingChar = _require3.isExtendingChar;

var _require4 = require("../edit");

var Selection = _require4.Selection;
var TextSelection = _require4.TextSelection;
var NodeSelection = _require4.NodeSelection;

// !! This module exports a number of ‘commands‘, functions that take
// a ProseMirror instance and try to perform some action on it,
// returning `false` if they don't apply. These are used to bind keys
// to, and to define [menu items](#menu).
//
// Most of the command functions defined here take a second, optional,
// boolean parameter. This can be set to `false` to do a ‘dry run’,
// where the function won't take any actual action, but will return
// information about whether it applies.

// :: (...[(ProseMirror, ?bool) → bool]) → (ProseMirror, ?bool) → bool
// Combine a number of command functions into a single function (which
// calls them one by one until one returns something other than
// `false`).

function chainCommands() {
  for (var _len = arguments.length, commands = Array(_len), _key = 0; _key < _len; _key++) {
    commands[_key] = arguments[_key];
  }

  return function (pm, apply) {
    for (var i = 0; i < commands.length; i++) {
      var val = commands[i](pm, apply);
      if (val !== false) return val;
    }
    return false;
  };
}
exports.chainCommands = chainCommands;

// :: (ProseMirror, ?bool) → bool
// Delete the selection, if there is one.
function deleteSelection(pm, apply) {
  if (pm.selection.empty) return false;
  if (apply !== false) pm.tr.replaceSelection().applyAndScroll();
  return true;
}
exports.deleteSelection = deleteSelection;

// :: (ProseMirror, ?bool) → bool
// If the selection is empty and at the start of a textblock, move
// that block closer to the block before it, by lifting it out of its
// parent or, if it has no parent it doesn't share with the node
// before it, moving it into a parent of that node, or joining it with
// that.
function joinBackward(pm, apply) {
  var _pm$selection = pm.selection;
  var $head = _pm$selection.$head;
  var empty = _pm$selection.empty;

  if (!empty) return false;

  if ($head.parentOffset > 0) return false;

  // Find the node before this one
  var before = void 0,
      cut = void 0;
  for (var i = $head.depth - 1; !before && i >= 0; i--) {
    if ($head.index(i) > 0) {
      cut = $head.before(i + 1);
      before = $head.node(i).child($head.index(i) - 1);
    }
  } // If there is no node before this, try to lift
  if (!before) {
    var range = $head.blockRange(),
        target = range && liftTarget(range);
    if (target == null) return false;
    if (apply !== false) pm.tr.lift(range, target).applyAndScroll();
    return true;
  }

  // If the node below has no content and the node above is
  // selectable, delete the node below and select the one above.
  if (before.type.isLeaf && before.type.selectable && $head.parent.content.size == 0) {
    if (apply !== false) {
      var tr = pm.tr.delete(cut, cut + $head.parent.nodeSize);
      tr.setSelection(new NodeSelection(tr.doc.resolve(cut - before.nodeSize)));
      tr.applyAndScroll();
    }
    return true;
  }

  // If the node doesn't allow children, delete it
  if (before.type.isLeaf) {
    if (apply !== false) pm.tr.delete(cut - before.nodeSize, cut).applyAndScroll();
    return true;
  }

  // Apply the joining algorithm
  return deleteBarrier(pm, cut, apply);
}
exports.joinBackward = joinBackward;

// :: (ProseMirror, ?bool) → bool
// If the selection is empty and the cursor is at the end of a
// textblock, move the node after it closer to the node with the
// cursor (lifting it out of parents that aren't shared, moving it
// into parents of the cursor block, or joining the two when they are
// siblings).
function joinForward(pm, apply) {
  var _pm$selection2 = pm.selection;
  var $head = _pm$selection2.$head;
  var empty = _pm$selection2.empty;

  if (!empty || $head.parentOffset < $head.parent.content.size) return false;

  // Find the node after this one
  var after = void 0,
      cut = void 0;
  for (var i = $head.depth - 1; !after && i >= 0; i--) {
    var parent = $head.node(i);
    if ($head.index(i) + 1 < parent.childCount) {
      after = parent.child($head.index(i) + 1);
      cut = $head.after(i + 1);
    }
  }

  // If there is no node after this, there's nothing to do
  if (!after) return false;

  // If the node doesn't allow children, delete it
  if (after.type.isLeaf) {
    if (apply !== false) pm.tr.delete(cut, cut + after.nodeSize).applyAndScroll();
    return true;
  } else {
    // Apply the joining algorithm
    return deleteBarrier(pm, cut, true);
  }
}
exports.joinForward = joinForward;

// :: (ProseMirror, ?bool) → bool
// Delete the character before the cursor, if the selection is empty
// and the cursor isn't at the start of a textblock.
function deleteCharBefore(pm, apply) {
  if (browser.ios) return false;
  var _pm$selection3 = pm.selection;
  var $head = _pm$selection3.$head;
  var empty = _pm$selection3.empty;

  if (!empty || $head.parentOffset == 0) return false;
  if (apply !== false) {
    var dest = moveBackward($head, "char");
    pm.tr.delete(dest, $head.pos).applyAndScroll();
  }
  return true;
}
exports.deleteCharBefore = deleteCharBefore;

// :: (ProseMirror, ?bool) → bool
// Delete the word before the cursor, if the selection is empty and
// the cursor isn't at the start of a textblock.
function deleteWordBefore(pm, apply) {
  var _pm$selection4 = pm.selection;
  var $head = _pm$selection4.$head;
  var empty = _pm$selection4.empty;

  if (!empty || $head.parentOffset == 0) return false;
  if (apply !== false) {
    var dest = moveBackward($head, "word");
    pm.tr.delete(dest, $head.pos).applyAndScroll();
  }
  return true;
}
exports.deleteWordBefore = deleteWordBefore;

// :: (ProseMirror, ?bool) → bool
// Delete the character after the cursor, if the selection is empty
// and the cursor isn't at the end of its textblock.
function deleteCharAfter(pm, apply) {
  var _pm$selection5 = pm.selection;
  var $head = _pm$selection5.$head;
  var empty = _pm$selection5.empty;

  if (!empty || $head.parentOffset == $head.parent.content.size) return false;
  if (apply !== false) {
    var dest = moveForward($head, "char");
    pm.tr.delete($head.pos, dest).applyAndScroll();
  }
  return true;
}
exports.deleteCharAfter = deleteCharAfter;

// :: (ProseMirror, ?bool) → bool
// Delete the word after the cursor, if the selection is empty and the
// cursor isn't at the end of a textblock.
function deleteWordAfter(pm, apply) {
  var _pm$selection6 = pm.selection;
  var $head = _pm$selection6.$head;
  var empty = _pm$selection6.empty;

  if (!empty || $head.parentOffset == $head.parent.content.size) return false;
  if (apply !== false) {
    var dest = moveForward($head, "word");
    pm.tr.delete($head.pos, dest).applyAndScroll();
  }
  return true;
}
exports.deleteWordAfter = deleteWordAfter;

// :: (ProseMirror, ?bool) → bool
// Join the selected block or, if there is a text selection, the
// closest ancestor block of the selection that can be joined, with
// the sibling above it.
function joinUp(pm, apply) {
  var _pm$selection7 = pm.selection;
  var node = _pm$selection7.node;
  var from = _pm$selection7.from;var point = void 0;
  if (node) {
    if (node.isTextblock || !joinable(pm.doc, from)) return false;
    point = from;
  } else {
    point = joinPoint(pm.doc, from, -1);
    if (point == null) return false;
  }
  if (apply !== false) {
    var tr = pm.tr.join(point);
    if (pm.selection.node) tr.setSelection(new NodeSelection(tr.doc.resolve(point - pm.doc.resolve(point).nodeBefore.nodeSize)));
    tr.applyAndScroll();
  }
  return true;
}
exports.joinUp = joinUp;

// :: (ProseMirror, ?bool) → bool
// Join the selected block, or the closest ancestor of the selection
// that can be joined, with the sibling after it.
function joinDown(pm, apply) {
  var node = pm.selection.node,
      nodeAt = pm.selection.from;
  var point = joinPointBelow(pm);
  if (!point) return false;
  if (apply !== false) {
    var tr = pm.tr.join(point);
    if (node) tr.setSelection(new NodeSelection(tr.doc.resolve(nodeAt)));
    tr.applyAndScroll();
  }
  return true;
}
exports.joinDown = joinDown;

// :: (ProseMirror, ?bool) → bool
// Lift the selected block, or the closest ancestor block of the
// selection that can be lifted, out of its parent node.
function lift(pm, apply) {
  var _pm$selection8 = pm.selection;
  var $from = _pm$selection8.$from;
  var $to = _pm$selection8.$to;

  var range = $from.blockRange($to),
      target = range && liftTarget(range);
  if (target == null) return false;
  if (apply !== false) pm.tr.lift(range, target).applyAndScroll();
  return true;
}
exports.lift = lift;

// :: (ProseMirror, ?bool) → bool
// If the selection is in a node whose type has a truthy `isCode`
// property, replace the selection with a newline character.
function newlineInCode(pm, apply) {
  var _pm$selection9 = pm.selection;
  var $from = _pm$selection9.$from;
  var $to = _pm$selection9.$to;
  var node = _pm$selection9.node;

  if (node) return false;
  if (!$from.parent.type.isCode || $to.pos >= $from.end()) return false;
  if (apply !== false) pm.tr.typeText("\n").applyAndScroll();
  return true;
}
exports.newlineInCode = newlineInCode;

// :: (ProseMirror, ?bool) → bool
// If a block node is selected, create an empty paragraph before (if
// it is its parent's first child) or after it.
function createParagraphNear(pm, apply) {
  var _pm$selection10 = pm.selection;
  var $from = _pm$selection10.$from;
  var $to = _pm$selection10.$to;
  var node = _pm$selection10.node;

  if (!node || !node.isBlock) return false;
  var type = $from.parent.defaultContentType($to.indexAfter());
  if (!type || !type.isTextblock) return false;
  if (apply !== false) {
    var side = ($from.parentOffset ? $to : $from).pos;
    var tr = pm.tr.insert(side, type.createAndFill());
    tr.setSelection(new TextSelection(tr.doc.resolve(side + 1)));
    tr.applyAndScroll();
  }
  return true;
}
exports.createParagraphNear = createParagraphNear;

// :: (ProseMirror, ?bool) → bool
// If the cursor is in an empty textblock that can be lifted, lift the
// block.
function liftEmptyBlock(pm, apply) {
  var _pm$selection11 = pm.selection;
  var $head = _pm$selection11.$head;
  var empty = _pm$selection11.empty;

  if (!empty || $head.parent.content.size) return false;
  if ($head.depth > 1 && $head.after() != $head.end(-1)) {
    var before = $head.before();
    if (canSplit(pm.doc, before)) {
      if (apply !== false) pm.tr.split(before).applyAndScroll();
      return true;
    }
  }
  var range = $head.blockRange(),
      target = range && liftTarget(range);
  if (target == null) return false;
  if (apply !== false) pm.tr.lift(range, target).applyAndScroll();
  return true;
}
exports.liftEmptyBlock = liftEmptyBlock;

// :: (ProseMirror, ?bool) → bool
// Split the parent block of the selection. If the selection is a text
// selection, delete it.
function splitBlock(pm, apply) {
  var _pm$selection12 = pm.selection;
  var $from = _pm$selection12.$from;
  var $to = _pm$selection12.$to;
  var node = _pm$selection12.node;

  if (node && node.isBlock) {
    if (!$from.parentOffset || !canSplit(pm.doc, $from.pos)) return false;
    if (apply !== false) pm.tr.split($from.pos).applyAndScroll();
    return true;
  } else {
    if (apply === false) return true;
    var atEnd = $to.parentOffset == $to.parent.content.size;
    var tr = pm.tr.delete($from.pos, $to.pos);
    var deflt = $from.depth == 0 ? null : $from.node(-1).defaultContentType($from.indexAfter(-1));
    var type = atEnd ? deflt : null;
    var can = canSplit(tr.doc, $from.pos, 1, type);
    if (!type && !can && canSplit(tr.doc, $from.pos, 1, deflt)) {
      type = deflt;
      can = true;
    }
    if (can) {
      tr.split($from.pos, 1, type);
      if (!atEnd && !$from.parentOffset && $from.parent.type != deflt) tr.setNodeType($from.before(), deflt);
    }
    tr.applyAndScroll();
    return true;
  }
}
exports.splitBlock = splitBlock;

// :: (ProseMirror, ?bool) → bool
// Move the selection to the node wrapping the current selection, if
// any. (Will not select the document node.)
function selectParentNode(pm, apply) {
  var sel = pm.selection,
      pos = void 0;
  if (sel.node) {
    if (!sel.$from.depth) return false;
    pos = sel.$from.before();
  } else {
    var same = sel.$head.sameDepth(sel.$anchor);
    if (same == 0) return false;
    pos = sel.$head.before(same);
  }
  if (apply !== false) pm.setNodeSelection(pos);
  return true;
}
exports.selectParentNode = selectParentNode;

// :: (ProseMirror, ?bool) → bool
// Undo the most recent change event, if any.
function undo(pm, apply) {
  if (!pm.history || pm.history.undoDepth == 0) return false;
  if (apply !== false) {
    pm.scrollIntoView();
    pm.history.undo();
  }
  return true;
}
exports.undo = undo;

// :: (ProseMirror, ?bool) → bool
// Redo the most recently undone change event, if any.
function redo(pm, apply) {
  if (!pm.history || pm.history.redoDepth == 0) return false;
  if (apply !== false) {
    pm.scrollIntoView();
    pm.history.redo();
  }
  return true;
}
exports.redo = redo;

function deleteBarrier(pm, cut, apply) {
  var $cut = pm.doc.resolve(cut),
      before = $cut.nodeBefore,
      after = $cut.nodeAfter,
      conn = void 0;
  if (joinable(pm.doc, cut)) {
    if (apply === false) return true;
    var tr = pm.tr.join(cut);
    if (tr.steps.length && before.content.size == 0 && !before.sameMarkup(after) && $cut.parent.canReplace($cut.index() - 1, $cut.index())) tr.setNodeType(cut - before.nodeSize, after.type, after.attrs);
    tr.applyAndScroll();
    return true;
  } else if (after.isTextblock && (conn = before.contentMatchAt($cut.index()).findWrapping(after.type, after.attrs))) {
    if (apply === false) return true;
    var end = cut + after.nodeSize,
        wrap = Fragment.empty;
    for (var i = conn.length - 1; i >= 0; i--) {
      wrap = Fragment.from(conn[i].type.create(conn[i].attrs, wrap));
    }wrap = Fragment.from(before.copy(wrap));
    pm.tr.step(new ReplaceAroundStep(cut - 1, end, cut, end, new Slice(wrap, 1, 0), conn.length, true)).join(end + 2 * conn.length, 1, true).applyAndScroll();
    return true;
  } else {
    var selAfter = Selection.findFrom($cut, 1);
    var range = selAfter.$from.blockRange(selAfter.$to),
        target = range && liftTarget(range);
    if (target == null) return false;
    if (apply !== false) pm.tr.lift(range, target).applyAndScroll();
    return true;
  }
}

// Get an offset moving backward from a current offset inside a node.
function moveBackward($pos, by) {
  if (by != "char" && by != "word") throw new RangeError("Unknown motion unit: " + by);

  var parent = $pos.parent,
      offset = $pos.parentOffset;

  var cat = null,
      counted = 0,
      pos = $pos.pos;
  for (;;) {
    if (offset == 0) return pos;

    var _parent$childBefore = parent.childBefore(offset);

    var start = _parent$childBefore.offset;
    var node = _parent$childBefore.node;

    if (!node) return pos;
    if (!node.isText) return cat ? pos : pos - 1;

    if (by == "char") {
      for (var i = offset - start; i > 0; i--) {
        if (!isExtendingChar(node.text.charAt(i - 1))) return pos - 1;
        offset--;
        pos--;
      }
    } else if (by == "word") {
      // Work from the current position backwards through text of a singular
      // character category (e.g. "cat" of "#!*") until reaching a character in a
      // different category (i.e. the end of the word).
      for (var _i = offset - start; _i > 0; _i--) {
        var nextCharCat = charCategory(node.text.charAt(_i - 1));
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat;else if (cat != nextCharCat) return pos;
        offset--;
        pos--;
        counted++;
      }
    }
  }
}

function moveForward($pos, by) {
  if (by != "char" && by != "word") throw new RangeError("Unknown motion unit: " + by);

  var parent = $pos.parent,
      offset = $pos.parentOffset,
      pos = $pos.pos;

  var cat = null,
      counted = 0;
  for (;;) {
    if (offset == parent.content.size) return pos;

    var _parent$childAfter = parent.childAfter(offset);

    var start = _parent$childAfter.offset;
    var node = _parent$childAfter.node;

    if (!node) return pos;
    if (!node.isText) return cat ? pos : pos + 1;

    if (by == "char") {
      for (var i = offset - start; i < node.text.length; i++) {
        if (!isExtendingChar(node.text.charAt(i + 1))) return pos + 1;
        offset++;
        pos++;
      }
    } else if (by == "word") {
      for (var _i2 = offset - start; _i2 < node.text.length; _i2++) {
        var nextCharCat = charCategory(node.text.charAt(_i2));
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat;else if (cat != nextCharCat) return pos;
        offset++;
        pos++;
        counted++;
      }
    }
  }
}

// Parameterized commands

function joinPointBelow(pm) {
  var _pm$selection13 = pm.selection;
  var node = _pm$selection13.node;
  var to = _pm$selection13.to;

  if (node) return joinable(pm.doc, to) ? to : null;else return joinPoint(pm.doc, to, 1);
}

// :: (NodeType, ?Object) → (pm: ProseMirror, apply: ?bool) → bool
// Wrap the selection in a node of the given type with the given
// attributes. When `apply` is `false`, just tell whether this is
// possible, without performing any action.
function wrapIn(nodeType, attrs) {
  return function (pm, apply) {
    var _pm$selection14 = pm.selection;
    var $from = _pm$selection14.$from;
    var $to = _pm$selection14.$to;

    var range = $from.blockRange($to),
        wrapping = range && findWrapping(range, nodeType, attrs);
    if (!wrapping) return false;
    if (apply !== false) pm.tr.wrap(range, wrapping).applyAndScroll();
    return true;
  };
}
exports.wrapIn = wrapIn;

// :: (NodeType, ?Object) → (pm: ProseMirror, apply: ?bool) → bool
// Try to the textblock around the selection to the given node type
// with the given attributes. Return `true` when this is possible. If
// `apply` is `false`, just report whether the change is possible,
// don't perform any action.
function setBlockType(nodeType, attrs) {
  return function (pm, apply) {
    var _pm$selection15 = pm.selection;
    var $from = _pm$selection15.$from;
    var $to = _pm$selection15.$to;
    var node = _pm$selection15.node;var depth = void 0;
    if (node) {
      depth = $from.depth;
    } else {
      if (!$from.depth || $to.pos > $from.end()) return false;
      depth = $from.depth - 1;
    }
    var target = node || $from.parent;
    if (!target.isTextblock || target.hasMarkup(nodeType, attrs)) return false;
    var index = $from.index(depth);
    if (!$from.node(depth).canReplaceWith(index, index + 1, nodeType)) return false;
    if (apply !== false) {
      var where = $from.before(depth + 1);
      pm.tr.clearMarkupFor(where, nodeType, attrs).setNodeType(where, nodeType, attrs).applyAndScroll();
    }
    return true;
  };
}
exports.setBlockType = setBlockType;

function markApplies(doc, from, to, type) {
  var can = false;
  doc.nodesBetween(from, to, function (node) {
    if (can) return false;
    can = node.isTextblock && node.contentMatchAt(0).allowsMark(type);
  });
  return can;
}

// :: (MarkType, ?Object) → (pm: ProseMirror, apply: ?bool) → bool
// Create a command function that toggles the given mark with the
// given attributes. Will return `false` when the current selection
// doesn't support that mark. If `apply` is not `false`, it will
// remove the mark if any marks of that type exist in the selection,
// or add it otherwise. If the selection is empty, this applies to the
// [active marks](#ProseMirror.activeMarks) instead of a range of the
// document.
function toggleMark(markType, attrs) {
  return function (pm, apply) {
    var _pm$selection16 = pm.selection;
    var empty = _pm$selection16.empty;
    var from = _pm$selection16.from;
    var to = _pm$selection16.to;

    if (!markApplies(pm.doc, from, to, markType)) return false;
    if (apply === false) return true;
    if (empty) {
      if (markType.isInSet(pm.activeMarks())) pm.removeActiveMark(markType);else pm.addActiveMark(markType.create(attrs));
    } else {
      if (pm.doc.rangeHasMark(from, to, markType)) pm.tr.removeMark(from, to, markType).applyAndScroll();else pm.tr.addMark(from, to, markType.create(attrs)).applyAndScroll();
    }
    return true;
  };
}
exports.toggleMark = toggleMark;

// :: Keymap
// A basic keymap containing bindings not specific to any schema.
// Binds the following keys (when multiple commands are listed, they
// are chained with [`chainCommands`](#commands.chainCommands):
//
// * **Enter** to `newlineInCode`, `createParagraphNear`, `liftEmptyBlock`, `splitBlock`
// * **Backspace** to `deleteSelection`, `joinBackward`, `deleteCharBefore`
// * **Mod-Backspace** to `deleteSelection`, `joinBackward`, `deleteWordBefore`
// * **Delete** to `deleteSelection`, `joinForward`, `deleteCharAfter`
// * **Mod-Delete** to `deleteSelection`, `joinForward`, `deleteWordAfter`
// * **Alt-Up** to `joinUp`
// * **Alt-Down** to `joinDown`
// * **Mod-[** to `lift`
// * **Esc** to `selectParentNode`
// * **Mod-Z** to `undo`
// * **Mod-Y** and **Shift-Mod-Z** to `redo`
var baseKeymap = new Keymap({
  "Enter": chainCommands(newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock),

  "Backspace": chainCommands(deleteSelection, joinBackward, deleteCharBefore),
  "Mod-Backspace": chainCommands(deleteSelection, joinBackward, deleteWordBefore),
  "Delete": chainCommands(deleteSelection, joinForward, deleteCharAfter),
  "Mod-Delete": chainCommands(deleteSelection, joinForward, deleteWordAfter),

  "Alt-Up": joinUp,
  "Alt-Down": joinDown,
  "Mod-[": lift,
  "Esc": selectParentNode,

  "Mod-Z": undo,
  "Mod-Y": redo,
  "Shift-Mod-Z": redo
});

if (browser.mac) baseKeymap = baseKeymap.update({
  "Ctrl-H": baseKeymap.lookup("Backspace"),
  "Alt-Backspace": baseKeymap.lookup("Mod-Backspace"),
  "Ctrl-D": baseKeymap.lookup("Delete"),
  "Ctrl-Alt-Backspace": baseKeymap.lookup("Mod-Delete"),
  "Alt-Delete": baseKeymap.lookup("Mod-Delete"),
  "Alt-D": baseKeymap.lookup("Mod-Delete")
});

exports.baseKeymap = baseKeymap;