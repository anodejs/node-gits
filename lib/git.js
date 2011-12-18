var spawn = require('child_process').spawn;
var path = require('path');

var prog = 'git';

// calls 'git' with the specified args
// callback = function(err, stdout, stderr).
module.exports = function (dir, args, callback) {
    if (typeof (args) == "string") args = [args];
    if (!dir) throw new Error('dir is required');
    var command = prog + ' ' + args.join(' ');
    console.info('git --', command, '(cwd:', dir, ')');
    var git = spawn(prog, args, { cwd: dir });
    var stdout = '';
    var stderr = '';
    git.stdout.on('data', function (data) { stdout += data.toString(); });
    git.stderr.on('data', function (data) { stderr += data.toString(); });
    git.on('exit', function (code) {
        var err = null;
        console.info('git -- exit code:', code);
        console.info('git -- stdout:', stdout);
        console.info('git -- stderr:', stderr);
        if (code != 0) err = { code: code, msg: stderr };
        if (callback) callback(err, stdout, stderr);
    });
};
