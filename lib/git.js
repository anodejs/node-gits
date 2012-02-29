var spawn = require('child_process').spawn;
var path = require('path');

var prog = 'git';

// calls 'git' with the specified args
// callback = function(err, stdout, stderr).
module.exports = function (dir, args, callback, logger) {
    logger = logger || console;
    if (typeof (args) == "string") args = [args];
    if (!dir) throw new Error('dir is required');
    var command = prog + ' ' + args.join(' ');
    logger.log('git --', command, '(cwd:', dir, ')');
    var git = spawn(prog, args, { cwd: dir });
    var stdout = '';
    var stderr = '';
    git.stdout.on('data', function (data) { stdout += data.toString(); });
    git.stderr.on('data', function (data) { stderr += data.toString(); });
    git.on('exit', function (code) {
        var err = null;
        logger.log('git -- exit code:', code);
        logger.log('git -- stdout:', stdout);
        logger.log('git -- stderr:', stderr);
        if (code != 0) err = { code: code, msg: stderr };
        if (callback) callback(err, stdout, stderr);
    });
};
