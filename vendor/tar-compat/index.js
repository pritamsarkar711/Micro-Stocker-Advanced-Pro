'use strict';

// tar v7 sets `__esModule` on its CommonJS entry but no `.default` export.
// CommonJS consumers compiled with tslib's `__importDefault` (e.g. @capacitor/cli,
// which does `require('tar').default.extract(...)`) then crash with
// "Cannot read properties of undefined (reading 'extract')".
// This shim forwards every v7 binding and adds the `.default` those
// consumers expect. Everything else (API, security fixes) is stock tar v7.
const tar = require('tar-real');

module.exports = tar;
if (module.exports.default === undefined) {
  module.exports.default = tar;
}
