var GitSync = require('./lib/gitsync');
module.exports = new GitSync();

/**
 * Execute arbitrary git commands.
 * @param dir The working directory to run from
 * @param args An array of arguments to pass to git
 * @param callback Called upon completion (err, stdout, stderr).
 */
module.exports.git = require('./lib/git');
