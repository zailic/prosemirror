"use strict";

var _require = require("../model");

var Fragment = _require.Fragment;
var Slice = _require.Slice;

var _require2 = require("../schema-table");

var TableRow = _require2.TableRow;
var AddColumnStep = _require2.AddColumnStep;
var RemoveColumnStep = _require2.RemoveColumnStep;

var _require3 = require("../transform");

var ReplaceStep = _require3.ReplaceStep;

var _require4 = require("../edit");

var Selection = _require4.Selection;

// Table-related command functions

// FIXME this module doesn't depend on the editor module. Do these
// functions which take an editor belong here? Can't express
// moveToNextCell without access to Selection

function findRow($pos, pred) {
  for (var d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type instanceof TableRow && (!pred || pred(d))) return d;
  }return -1;
}

// :: (ProseMirror, ?bool) → bool
// Command function that adds a column before the column with the
// selection.
function addColumnBefore(pm, apply) {
  var $from = pm.selection.$from,
      cellFrom = void 0;
  var rowDepth = findRow($from, function (d) {
    return cellFrom = d == $from.depth ? $from.nodeBefore : $from.node(d + 1);
  });
  if (rowDepth == -1) return false;
  if (apply !== false) pm.tr.step(AddColumnStep.create(pm.doc, $from.before(rowDepth - 1), $from.index(rowDepth), cellFrom.type, cellFrom.attrs)).apply();
  return true;
}
exports.addColumnBefore = addColumnBefore;

// :: (ProseMirror, ?bool) → bool
// Command function that adds a column after the column with the
// selection.
function addColumnAfter(pm, apply) {
  var $from = pm.selection.$from,
      cellFrom = void 0;
  var rowDepth = findRow($from, function (d) {
    return cellFrom = d == $from.depth ? $from.nodeAfter : $from.node(d + 1);
  });
  if (rowDepth == -1) return false;
  if (apply !== false) pm.tr.step(AddColumnStep.create(pm.doc, $from.before(rowDepth - 1), $from.indexAfter(rowDepth) + (rowDepth == $from.depth ? 1 : 0), cellFrom.type, cellFrom.attrs)).apply();
  return true;
}
exports.addColumnAfter = addColumnAfter;

// :: (ProseMirror, ?bool) → bool
// Command function that removes the column with the selection.
function removeColumn(pm, apply) {
  var $from = pm.selection.$from;
  var rowDepth = findRow($from, function (d) {
    return $from.node(d).childCount > 1;
  });
  if (rowDepth == -1) return false;
  if (apply !== false) pm.tr.step(RemoveColumnStep.create(pm.doc, $from.before(rowDepth - 1), $from.index(rowDepth))).apply();
  return true;
}
exports.removeColumn = removeColumn;

function addRow(pm, apply, side) {
  var $from = pm.selection.$from;
  var rowDepth = findRow($from);
  if (rowDepth == -1) return false;
  if (apply !== false) {
    (function () {
      var exampleRow = $from.node(rowDepth);
      var cells = [],
          pos = side < 0 ? $from.before(rowDepth) : $from.after(rowDepth);
      exampleRow.forEach(function (cell) {
        return cells.push(cell.type.createAndFill(cell.attrs));
      });
      var row = exampleRow.copy(Fragment.from(cells));
      pm.tr.step(new ReplaceStep(pos, pos, new Slice(Fragment.from(row), 0, 0))).apply();
    })();
  }
  return true;
}

// :: (ProseMirror, ?bool) → bool
// Command function that adds a row after the row with the
// selection.
function addRowBefore(pm, apply) {
  return addRow(pm, apply, -1);
}
exports.addRowBefore = addRowBefore;

// :: (ProseMirror, ?bool) → bool
// Command function that adds a row before the row with the
// selection.
function addRowAfter(pm, apply) {
  return addRow(pm, apply, 1);
}
exports.addRowAfter = addRowAfter;

// :: (ProseMirror, ?bool) → bool
// Command function that removes the row with the selection.
function removeRow(pm, apply) {
  var $from = pm.selection.$from;
  var rowDepth = findRow($from, function (d) {
    return $from.node(d - 1).childCount > 1;
  });
  if (rowDepth == -1) return false;
  if (apply !== false) pm.tr.step(new ReplaceStep($from.before(rowDepth), $from.after(rowDepth), Slice.empty)).apply();
  return true;
}
exports.removeRow = removeRow;

function moveCell(pm, dir, apply) {
  var $from = pm.selection.$from;

  var rowDepth = findRow($from);
  if (rowDepth == -1) return false;
  var row = $from.node(rowDepth),
      newIndex = $from.index(rowDepth) + dir;
  if (newIndex >= 0 && newIndex < row.childCount) {
    var $cellStart = pm.doc.resolve(row.content.offsetAt(newIndex) + $from.start(rowDepth));
    var sel = Selection.findFrom($cellStart, 1);
    if (!sel || sel.from >= $cellStart.end()) return false;
    if (apply !== false) pm.setSelection(sel);
    return true;
  } else {
    var rowIndex = $from.index(rowDepth - 1) + dir,
        table = $from.node(rowDepth - 1);
    if (rowIndex < 0 || rowIndex >= table.childCount) return false;
    var cellStart = dir > 0 ? $from.after(rowDepth) + 2 : $from.before(rowDepth) - 2 - table.child(rowIndex).lastChild.content.size;
    var _$cellStart = pm.doc.resolve(cellStart),
        _sel = Selection.findFrom(_$cellStart, 1);
    if (!_sel || _sel.from >= _$cellStart.end()) return false;
    if (apply !== false) pm.setSelection(_sel);
    return true;
  }
}

// :: (ProseMirror, ?bool) → bool
// Move to the next cell in the current table, if there is one.
function selectNextCell(pm, apply) {
  return moveCell(pm, 1, apply);
}
exports.selectNextCell = selectNextCell;

// :: (ProseMirror, ?bool) → bool
// Move to the previous cell in the current table, if there is one.
function selectPreviousCell(pm, apply) {
  return moveCell(pm, -1, apply);
}
exports.selectPreviousCell = selectPreviousCell;