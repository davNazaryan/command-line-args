'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var a = require('array-tools');
var o = require('object-tools');
var Definitions = require('./definitions');
var option = require('./option');
var cliUsage = require('command-line-usage');
var findReplace = require('find-replace');
var t = require('typical');

/**
A library to collect command-line args and generate a usage guide.

@module command-line-args
*/
module.exports = commandLineArgs;

/**
@class
@classdesc A class encapsulating operations you can perform using an [OptionDefinition](#exp_module_definition--OptionDefinition) array as input.
@param {module:definition[]} - An optional array of [OptionDefinition](#exp_module_definition--OptionDefinition) objects
@typicalname cli
@alias module:command-line-args
@example
```js
var commandLineArgs = require("command-line-args")
var cli = commandLineArgs([
    { name: "file" },
    { name: "verbose" },
    { name: "depth"}
])
```
*/

var CommandLineArgs = (function () {
  function CommandLineArgs(definitions) {
    _classCallCheck(this, CommandLineArgs);

    this.definitions = new Definitions(definitions);
  }

  /**
  Returns an object containing all the values and flags set on the command line. By default it parses the global [`process.argv`](https://nodejs.org/api/process.html#process_process_argv) array.
   @param [argv] {string[]} - An array of strings, which if passed will be parsed instead of `process.argv`.
  @returns {object}
  @throws if the user specifies an unknown option
  @throws if an option definition is missing the required `name` property
  @throws if an option definition has a `type` property that's not a function
   */

  _createClass(CommandLineArgs, [{
    key: 'parse',
    value: function parse(argv) {
      var _this = this;

      /* if no argv supplied, assume we are parsing process.argv */
      argv = argv || process.argv;
      if (argv === process.argv) {
        argv.splice(0, 2);
      } else {
        argv = a.arrayify(argv);
      }

      /* expand --option=name style args */
      var optEquals = option.optEquals;
      if (argv.some(optEquals.test.bind(optEquals))) {
        var expandedArgs = [];
        argv.forEach(function (arg) {
          var matches = arg.match(optEquals.re);
          if (matches) {
            expandedArgs.push(matches[1], matches[2]);
          } else {
            expandedArgs.push(arg);
          }
        });
        argv = expandedArgs;
      }

      /* expand getopt-style combined options */
      var combinedArg = option.combined;
      var hasGetopt = argv.some(combinedArg.test.bind(combinedArg));
      if (hasGetopt) {
        findReplace(argv, combinedArg.re, function (arg) {
          arg = arg.slice(1);
          return arg.split('').map(function (letter) {
            return '-' + letter;
          });
        });
      }

      /* validate input */
      var invalidMessage = this.definitions.validate(argv);
      if (invalidMessage) {
        throw Error(invalidMessage);
      }

      /* create output initialised with default values */
      var output = this.definitions.createOutput();
      var def;

      /* walk argv building the output */
      argv.forEach(function (item) {
        if (option.isOption(item)) {
          def = _this.definitions.get(item);
          if (!t.isDefined(output[def.name])) outputSet(output, def.name, def.getInitialValue());
          if (def.isBoolean()) {
            outputSet(output, def.name, true);
            def = null;
          }
        } else {
          var value = item;
          if (!def) {
            def = _this.definitions.getDefault();
            if (!def) return;
            if (!t.isDefined(output[def.name])) outputSet(output, def.name, def.getInitialValue());
          }

          var outputValue = def.type ? def.type(value) : value;
          outputSet(output, def.name, outputValue);

          if (!def.multiple) def = null;
        }
      });

      /* clear _initial flags */
      o.each(output, function (value, key) {
        if (Array.isArray(value) && value._initial) delete value._initial;
      });

      /* group the output values */
      if (this.definitions.isGrouped()) {
        var grouped = {
          _all: output
        };

        this.definitions.whereGrouped().forEach(function (def) {
          a.arrayify(def.group).forEach(function (groupName) {
            grouped[groupName] = grouped[groupName] || {};
            if (t.isDefined(output[def.name])) {
              grouped[groupName][def.name] = output[def.name];
            }
          });
        });

        this.definitions.whereNotGrouped().forEach(function (def) {
          if (t.isDefined(output[def.name])) {
            if (!grouped._none) grouped._none = {};
            grouped._none[def.name] = output[def.name];
          }
        });
        return grouped;
      } else {
        return output;
      }
    }

    /**
    Generates a usage guide. Please see [command-line-usage](https://github.com/75lb/command-line-usage) for full instructions of how to use.
     @param [options] {object} - the options to pass to [command-line-usage](https://github.com/75lb/command-line-usage)
    @returns {string}
    */
  }, {
    key: 'getUsage',
    value: function getUsage(options) {
      return cliUsage(this.definitions.val(), options);
    }
  }]);

  return CommandLineArgs;
})();

function outputSet(output, property, value) {
  if (output[property] && output[property]._initial) {
    output[property] = [];
    delete output[property]._initial;
  }
  if (Array.isArray(output[property])) {
    output[property].push(value);
  } else {
    output[property] = value;
  }
}

/* Factory method: initialises a new CommandLineArgs instance. */
function commandLineArgs(definitions) {
  return new CommandLineArgs(definitions);
}