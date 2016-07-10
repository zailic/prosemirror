"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("../util/dom");

var elt = _require.elt;
var insertCSS = _require.insertCSS;

var _require2 = require("../commands");

var undo = _require2.undo;
var redo = _require2.redo;
var lift = _require2.lift;
var joinUp = _require2.joinUp;
var selectParentNode = _require2.selectParentNode;
var wrapIn = _require2.wrapIn;
var setBlockType = _require2.setBlockType;
var toggleMark = _require2.toggleMark;

var _require3 = require("../util/obj");

var copyObj = _require3.copyObj;

var _require4 = require("./icons");

var getIcon = _require4.getIcon;


var prefix = "ProseMirror-menu";

// ;; An icon or label that, when clicked, executes a command.

var MenuItem = function () {
  // :: (MenuItemSpec)

  function MenuItem(spec) {
    _classCallCheck(this, MenuItem);

    // :: MenuItemSpec
    // The spec used to create the menu item.
    this.spec = spec;
  }

  // :: (ProseMirror) → DOMNode
  // Renders the icon according to its [display
  // spec](#MenuItemSpec.display), and adds an event handler which
  // executes the command when the representation is clicked.


  _createClass(MenuItem, [{
    key: "render",
    value: function render(pm) {
      var disabled = false,
          spec = this.spec;
      if (spec.select && !spec.select(pm)) {
        if (spec.onDeselected == "disable") disabled = true;else return null;
      }
      var active = spec.active && !disabled && spec.active(pm);

      var dom = void 0;
      if (spec.render) {
        dom = spec.render(pm);
      } else if (spec.icon) {
        dom = getIcon(spec.icon);
        if (active) dom.classList.add(prefix + "-active");
      } else if (spec.label) {
        dom = elt("div", null, pm.translate(spec.label));
      } else {
        throw new RangeError("MenuItem without render, icon, or label property");
      }

      if (spec.title) dom.setAttribute("title", pm.translate(spec.title));
      if (spec.class) dom.classList.add(spec.class);
      if (disabled) dom.classList.add(prefix + "-disabled");
      if (spec.css) dom.style.cssText += spec.css;
      if (!disabled) dom.addEventListener(spec.execEvent || "mousedown", function (e) {
        e.preventDefault();e.stopPropagation();
        pm.on.interaction.dispatch();
        spec.run(pm);
      });
      return dom;
    }
  }]);

  return MenuItem;
}();

exports.MenuItem = MenuItem;

// :: Object #path=MenuItemSpec #kind=interface
// The configuration object passed to the `MenuItem` constructor.

// :: (ProseMirror) #path=MenuItemSpec.run
// The function to execute when the menu item is activated.

// :: ?(ProseMirror) → bool #path=MenuItemSpec.select
// Optional function that is used to determine whether the item is
// appropriate at the moment.

// :: ?string #path=MenuItemSpec.onDeselect
// Determines what happens when [`select`](#MenuItemSpec.select)
// returns false. The default is to hide the item, you can set this to
// `"disable"` to instead render the item with a disabled style.

// :: ?(ProseMirror) → bool #path=MenuItemSpec.active
// A predicate function to determine whether the item is 'active' (for
// example, the item for toggling the strong mark might be active then
// the cursor is in strong text).

// :: ?(ProseMirror) → DOMNode #path=MenuItemSpec.render
// A function that renders the item. You must provide either this,
// [`icon`](#MenuItemSpec.icon), or [`label`](#MenuItemSpec.label).

// :: ?Object #path=MenuItemSpec.icon
// Describes an icon to show for this item. The object may specify an
// SVG icon, in which case its `path` property should be an [SVG path
// spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d),
// and `width` and `height` should provide the viewbox in which that
// path exists. Alternatively, it may have a `text` property
// specifying a string of text that makes up the icon, with an
// optional `css` property giving additional CSS styling for the text.
// _Or_ it may contain `dom` property containing a DOM node.

// :: ?string #path=MenuItemSpec.label
// Makes the item show up as a text label. Mostly useful for items
// wrapped in a [drop-down](#Dropdown) or similar menu. The object
// should have a `label` property providing the text to display.

// :: ?string #path=MenuItemSpec.title
// Defines DOM title (mouseover) text for the item.

// :: string #path=MenuItemSpec.class
// Optionally adds a CSS class to the item's DOM representation.

// :: string #path=MenuItemSpec.css
// Optionally adds a string of inline CSS to the item's DOM
// representation.

// :: string #path=MenuItemSpec.execEvent
// Defines which event on the command's DOM representation should
// trigger the execution of the command. Defaults to mousedown.

// ;; A drop-down menu, displayed as a label with a downwards-pointing
// triangle to the right of it.

var Dropdown = function () {
  // :: ([MenuElement], ?Object)
  // Create a dropdown wrapping the elements. Options may include
  // the following properties:
  //
  // **`label`**`: string`
  //   : The label to show on the drop-down control.
  //
  // **`title`**`: string`
  //   : Sets the
  //     [`title`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title)
  //     attribute given to the menu control.
  //
  // **`class`**`: string`
  //   : When given, adds an extra CSS class to the menu control.
  //
  // **`css`**`: string`
  //   : When given, adds an extra set of CSS styles to the menu control.

  function Dropdown(content, options) {
    _classCallCheck(this, Dropdown);

    this.options = options || {};
    this.content = Array.isArray(content) ? content : [content];
  }

  // :: (ProseMirror) → DOMNode
  // Returns a node showing the collapsed menu, which expands when clicked.


  _createClass(Dropdown, [{
    key: "render",
    value: function render(pm) {
      var _this = this;

      var items = renderDropdownItems(this.content, pm);
      if (!items.length) return null;

      var dom = elt("div", { class: prefix + "-dropdown " + (this.options.class || ""),
        style: this.options.css,
        title: this.options.title && pm.translate(this.options.title) }, pm.translate(this.options.label));
      var open = null;
      dom.addEventListener("mousedown", function (e) {
        e.preventDefault();e.stopPropagation();
        if (open && open()) open = null;else open = _this.expand(pm, dom, items);
      });
      return dom;
    }
  }, {
    key: "expand",
    value: function expand(pm, dom, items) {
      var box = dom.getBoundingClientRect(),
          outer = pm.wrapper.getBoundingClientRect();
      var menuDOM = elt("div", { class: prefix + "-dropdown-menu " + (this.options.class || ""),
        style: "left: " + (box.left - outer.left) + "px; top: " + (box.bottom - outer.top) + "px" }, items);

      var done = false;
      function finish() {
        if (done) return;
        done = true;
        pm.on.interaction.remove(finish);
        pm.wrapper.removeChild(menuDOM);
        return true;
      }
      pm.on.interaction.dispatch();
      pm.wrapper.appendChild(menuDOM);
      pm.on.interaction.add(finish);
      return finish;
    }
  }]);

  return Dropdown;
}();

exports.Dropdown = Dropdown;

function renderDropdownItems(items, pm) {
  var rendered = [];
  for (var i = 0; i < items.length; i++) {
    var inner = items[i].render(pm);
    if (inner) rendered.push(elt("div", { class: prefix + "-dropdown-item" }, inner));
  }
  return rendered;
}

// ;; Represents a submenu wrapping a group of elements that start
// hidden and expand to the right when hovered over or tapped.

var DropdownSubmenu = function () {
  // :: ([MenuElement], ?Object)
  // Creates a submenu for the given group of menu elements. The
  // following options are recognized:
  //
  // **`label`**`: string`
  //   : The label to show on the submenu.

  function DropdownSubmenu(content, options) {
    _classCallCheck(this, DropdownSubmenu);

    this.options = options || {};
    this.content = Array.isArray(content) ? content : [content];
  }

  // :: (ProseMirror) → DOMNode
  // Renders the submenu.


  _createClass(DropdownSubmenu, [{
    key: "render",
    value: function render(pm) {
      var items = renderDropdownItems(this.content, pm);
      if (!items.length) return null;

      var label = elt("div", { class: prefix + "-submenu-label" }, pm.translate(this.options.label));
      var wrap = elt("div", { class: prefix + "-submenu-wrap" }, label, elt("div", { class: prefix + "-submenu" }, items));
      label.addEventListener("mousedown", function (e) {
        e.preventDefault();e.stopPropagation();
        wrap.classList.toggle(prefix + "-submenu-wrap-active");
      });
      return wrap;
    }
  }]);

  return DropdownSubmenu;
}();

exports.DropdownSubmenu = DropdownSubmenu;

// :: (ProseMirror, [union<MenuElement, [MenuElement]>]) → ?DOMFragment
// Render the given, possibly nested, array of menu elements into a
// document fragment, placing separators between them (and ensuring no
// superfluous separators appear when some of the groups turn out to
// be empty).
function renderGrouped(pm, content) {
  var result = document.createDocumentFragment(),
      needSep = false;
  for (var i = 0; i < content.length; i++) {
    var items = content[i],
        added = false;
    for (var j = 0; j < items.length; j++) {
      var rendered = items[j].render(pm);
      if (rendered) {
        if (!added && needSep) result.appendChild(separator());
        result.appendChild(elt("span", { class: prefix + "item" }, rendered));
        added = true;
      }
    }
    if (added) needSep = true;
  }
  return result;
}
exports.renderGrouped = renderGrouped;

function separator() {
  return elt("span", { class: prefix + "separator" });
}

// :: Object
// A set of basic editor-related icons. Contains the properties
// `join`, `lift`, `selectParentNode`, `undo`, `redo`, `strong`, `em`,
// `code`, `link`, `bulletList`, `orderedList`, and `blockquote`, each
// holding an object that can be used as the `icon` option to
// `MenuItem`.
var icons = {
  join: {
    width: 800, height: 900,
    path: "M0 75h800v125h-800z M0 825h800v-125h-800z M250 400h100v-100h100v100h100v100h-100v100h-100v-100h-100z"
  },
  lift: {
    width: 1024, height: 1024,
    path: "M219 310v329q0 7-5 12t-12 5q-8 0-13-5l-164-164q-5-5-5-13t5-13l164-164q5-5 13-5 7 0 12 5t5 12zM1024 749v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12zM1024 530v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 310v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 91v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12z"
  },
  selectParentNode: { text: "⬚", css: "font-weight: bold" },
  undo: {
    width: 1024, height: 1024,
    path: "M761 1024c113-206 132-520-313-509v253l-384-384 384-384v248c534-13 594 472 313 775z"
  },
  redo: {
    width: 1024, height: 1024,
    path: "M576 248v-248l384 384-384 384v-253c-446-10-427 303-313 509-280-303-221-789 313-775z"
  },
  strong: {
    width: 805, height: 1024,
    path: "M317 869q42 18 80 18 214 0 214-191 0-65-23-102-15-25-35-42t-38-26-46-14-48-6-54-1q-41 0-57 5 0 30-0 90t-0 90q0 4-0 38t-0 55 2 47 6 38zM309 442q24 4 62 4 46 0 81-7t62-25 42-51 14-81q0-40-16-70t-45-46-61-24-70-8q-28 0-74 7 0 28 2 86t2 86q0 15-0 45t-0 45q0 26 0 39zM0 950l1-53q8-2 48-9t60-15q4-6 7-15t4-19 3-18 1-21 0-19v-37q0-561-12-585-2-4-12-8t-25-6-28-4-27-2-17-1l-2-47q56-1 194-6t213-5q13 0 39 0t38 0q40 0 78 7t73 24 61 40 42 59 16 78q0 29-9 54t-22 41-36 32-41 25-48 22q88 20 146 76t58 141q0 57-20 102t-53 74-78 48-93 27-100 8q-25 0-75-1t-75-1q-60 0-175 6t-132 6z"
  },
  em: {
    width: 585, height: 1024,
    path: "M0 949l9-48q3-1 46-12t63-21q16-20 23-57 0-4 35-165t65-310 29-169v-14q-13-7-31-10t-39-4-33-3l10-58q18 1 68 3t85 4 68 1q27 0 56-1t69-4 56-3q-2 22-10 50-17 5-58 16t-62 19q-4 10-8 24t-5 22-4 26-3 24q-15 84-50 239t-44 203q-1 5-7 33t-11 51-9 47-3 32l0 10q9 2 105 17-1 25-9 56-6 0-18 0t-18 0q-16 0-49-5t-49-5q-78-1-117-1-29 0-81 5t-69 6z"
  },
  code: {
    width: 896, height: 1024,
    path: "M608 192l-96 96 224 224-224 224 96 96 288-320-288-320zM288 192l-288 320 288 320 96-96-224-224 224-224-96-96z"
  },
  link: {
    width: 951, height: 1024,
    path: "M832 694q0-22-16-38l-118-118q-16-16-38-16-24 0-41 18 1 1 10 10t12 12 8 10 7 14 2 15q0 22-16 38t-38 16q-8 0-15-2t-14-7-10-8-12-12-10-10q-18 17-18 41 0 22 16 38l117 118q15 15 38 15 22 0 38-14l84-83q16-16 16-38zM430 292q0-22-16-38l-117-118q-16-16-38-16-22 0-38 15l-84 83q-16 16-16 38 0 22 16 38l118 118q15 15 38 15 24 0 41-17-1-1-10-10t-12-12-8-10-7-14-2-15q0-22 16-38t38-16q8 0 15 2t14 7 10 8 12 12 10 10q18-17 18-41zM941 694q0 68-48 116l-84 83q-47 47-116 47-69 0-116-48l-117-118q-47-47-47-116 0-70 50-119l-50-50q-49 50-118 50-68 0-116-48l-118-118q-48-48-48-116t48-116l84-83q47-47 116-47 69 0 116 48l117 118q47 47 47 116 0 70-50 119l50 50q49-50 118-50 68 0 116 48l118 118q48 48 48 116z"
  },
  bulletList: {
    width: 768, height: 896,
    path: "M0 512h128v-128h-128v128zM0 256h128v-128h-128v128zM0 768h128v-128h-128v128zM256 512h512v-128h-512v128zM256 256h512v-128h-512v128zM256 768h512v-128h-512v128z"
  },
  orderedList: {
    width: 768, height: 896,
    path: "M320 512h448v-128h-448v128zM320 768h448v-128h-448v128zM320 128v128h448v-128h-448zM79 384h78v-256h-36l-85 23v50l43-2v185zM189 590c0-36-12-78-96-78-33 0-64 6-83 16l1 66c21-10 42-15 67-15s32 11 32 28c0 26-30 58-110 112v50h192v-67l-91 2c49-30 87-66 87-113l1-1z"
  },
  blockquote: {
    width: 640, height: 896,
    path: "M0 448v256h256v-256h-128c0 0 0-128 128-128v-128c0 0-256 0-256 256zM640 320v-128c0 0-256 0-256 256v256h256v-256h-128c0 0 0-128 128-128z"
  }
};
exports.icons = icons;

// :: MenuItem
// Menu item for the `joinUp` command.
var joinUpItem = new MenuItem({
  title: "Join with above block",
  run: joinUp,
  select: function select(pm) {
    return joinUp(pm, false);
  },
  icon: icons.join
});
exports.joinUpItem = joinUpItem;

// :: MenuItem
// Menu item for the `lift` command.
var liftItem = new MenuItem({
  title: "Lift out of enclosing block",
  run: lift,
  select: function select(pm) {
    return lift(pm, false);
  },
  icon: icons.lift
});
exports.liftItem = liftItem;

// :: MenuItem
// Menu item for the `selectParentNode` command.
var selectParentNodeItem = new MenuItem({
  title: "Select parent node",
  run: selectParentNode,
  select: function select(pm) {
    return selectParentNode(pm, false);
  },
  icon: icons.selectParentNode
});
exports.selectParentNodeItem = selectParentNodeItem;

// :: MenuItem
// Menu item for the `undo` command.
var undoItem = new MenuItem({
  title: "Undo last change",
  run: undo,
  select: function select(pm) {
    return undo(pm, false);
  },
  icon: icons.undo
});
exports.undoItem = undoItem;

// :: MenuItem
// Menu item for the `redo` command.
var redoItem = new MenuItem({
  title: "Redo last undone change",
  run: redo,
  select: function select(pm) {
    return redo(pm, false);
  },
  icon: icons.redo
});
exports.redoItem = redoItem;

function markActive(pm, type) {
  var _pm$selection = pm.selection;
  var from = _pm$selection.from;
  var to = _pm$selection.to;
  var empty = _pm$selection.empty;

  if (empty) return type.isInSet(pm.activeMarks());else return pm.doc.rangeHasMark(from, to, type);
}

// :: (MarkType, Object) → MenuItem
// Create a menu item for toggling a mark on the selection. Will create
// `run`, `active`, and `select` properties. Other properties have to
// be supplied in the `options` object. When `options.attrs` is a
// function, it will be called with `(pm: ProseMirror, callback:
// (attrs: ?Object))` arguments, and should produce the attributes for
// the mark and then call the callback. Otherwise, it may be an object
// providing the attributes directly.
function toggleMarkItem(markType, options) {
  var command = toggleMark(markType, options.attrs);
  var base = {
    run: function run(pm) {
      command(pm);
    },
    active: function active(pm) {
      return markActive(pm, markType);
    },
    select: function select(pm) {
      return command(pm, false);
    }
  };
  if (options.attrs instanceof Function) base.run = function (pm) {
    if (markActive(pm, markType)) command(pm);else options.attrs(pm, function (attrs) {
      return toggleMark(markType, attrs)(pm);
    });
  };

  return new MenuItem(copyObj(options, base));
}
exports.toggleMarkItem = toggleMarkItem;

// :: (NodeType, Object) → MenuItem
// Create a menu item for inserting a node of the given type. Adds
// `run` and `select` properties to the ones provided in `options`.
// `options.attrs` can be an object or a function, like in
// `toggleMarkItem`.
function insertItem(nodeType, options) {
  return new MenuItem(copyObj(options, {
    select: function select(pm) {
      var $from = pm.selection.$from;
      for (var d = $from.depth; d >= 0; d--) {
        var index = $from.index(d);
        if ($from.node(d).canReplaceWith(index, index, nodeType, options.attrs instanceof Function ? null : options.attrs)) return true;
      }
    },
    run: function run(pm) {
      function done(attrs) {
        pm.tr.replaceSelection(nodeType.createAndFill(attrs)).apply();
      }
      if (options.attrs instanceof Function) options.attrs(pm, done);else done(options.attrs);
    }
  }));
}
exports.insertItem = insertItem;

// :: (NodeType, Object) → MenuItem
// Build a menu item for wrapping the selection in a given node type.
// Adds `run` and `select` properties to the ones present in
// `options`. `options.attrs` may be an object or a function, as in
// `toggleMarkItem`.
function wrapItem(nodeType, options) {
  return new MenuItem(copyObj(options, {
    run: function run(pm) {
      if (options.attrs instanceof Function) options.attrs(pm, function (attrs) {
        return wrapIn(nodeType, attrs)(pm);
      });else wrapIn(nodeType, options.attrs)(pm);
    },
    select: function select(pm) {
      return wrapIn(nodeType, options.attrs instanceof Function ? null : options.attrs)(pm, false);
    }
  }));
}
exports.wrapItem = wrapItem;

// :: (NodeType, Object) → MenuItem
// Build a menu item for changing the type of the textblock around the
// selection to the given type. Provides `run`, `active`, and `select`
// properties. Others must be given in `options`. `options.attrs` may
// be an object to provide the attributes for the textblock node.
function blockTypeItem(nodeType, options) {
  var command = setBlockType(nodeType, options.attrs);
  return new MenuItem(copyObj(options, {
    run: command,
    select: function select(pm) {
      return command(pm, false);
    },
    active: function active(pm) {
      var _pm$selection2 = pm.selection;
      var $from = _pm$selection2.$from;
      var to = _pm$selection2.to;
      var node = _pm$selection2.node;

      if (node) return node.hasMarkup(nodeType, options.attrs);
      return to <= $from.end() && $from.parent.hasMarkup(nodeType, options.attrs);
    }
  }));
}
exports.blockTypeItem = blockTypeItem;

insertCSS("\n\n.ProseMirror-textblock-dropdown {\n  min-width: 3em;\n}\n\n." + prefix + " {\n  margin: 0 -4px;\n  line-height: 1;\n}\n\n.ProseMirror-tooltip ." + prefix + " {\n  width: -webkit-fit-content;\n  width: fit-content;\n  white-space: pre;\n}\n\n." + prefix + "item {\n  margin-right: 3px;\n  display: inline-block;\n}\n\n." + prefix + "separator {\n  border-right: 1px solid #ddd;\n  margin-right: 3px;\n}\n\n." + prefix + "-dropdown, ." + prefix + "-dropdown-menu {\n  font-size: 90%;\n  white-space: nowrap;\n}\n\n." + prefix + "-dropdown {\n  padding: 1px 14px 1px 4px;\n  display: inline-block;\n  vertical-align: 1px;\n  position: relative;\n  cursor: pointer;\n}\n\n." + prefix + "-dropdown:after {\n  content: \"\";\n  border-left: 4px solid transparent;\n  border-right: 4px solid transparent;\n  border-top: 4px solid currentColor;\n  opacity: .6;\n  position: absolute;\n  right: 2px;\n  top: calc(50% - 2px);\n}\n\n." + prefix + "-dropdown-menu, ." + prefix + "-submenu {\n  position: absolute;\n  background: white;\n  color: #666;\n  border: 1px solid #aaa;\n  padding: 2px;\n}\n\n." + prefix + "-dropdown-menu {\n  z-index: 15;\n  min-width: 6em;\n}\n\n." + prefix + "-dropdown-item {\n  cursor: pointer;\n  padding: 2px 8px 2px 4px;\n}\n\n." + prefix + "-dropdown-item:hover {\n  background: #f2f2f2;\n}\n\n." + prefix + "-submenu-wrap {\n  position: relative;\n  margin-right: -4px;\n}\n\n." + prefix + "-submenu-label:after {\n  content: \"\";\n  border-top: 4px solid transparent;\n  border-bottom: 4px solid transparent;\n  border-left: 4px solid currentColor;\n  opacity: .6;\n  position: absolute;\n  right: 4px;\n  top: calc(50% - 4px);\n}\n\n." + prefix + "-submenu {\n  display: none;\n  min-width: 4em;\n  left: 100%;\n  top: -3px;\n}\n\n." + prefix + "-active {\n  background: #eee;\n  border-radius: 4px;\n}\n\n." + prefix + "-active {\n  background: #eee;\n  border-radius: 4px;\n}\n\n." + prefix + "-disabled {\n  opacity: .3;\n}\n\n." + prefix + "-submenu-wrap:hover ." + prefix + "-submenu, ." + prefix + "-submenu-wrap-active ." + prefix + "-submenu {\n  display: block;\n}\n");