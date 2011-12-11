var gitsync = require('../main');
var fs = require('fs');
var path = require('path');

if (!process.argv[2]) throw new Error('argv[1] should contain the name of the target directory');

var rand = Math.round(Math.random() * 10000);
var target = path.join(process.env.TMP || process.env.TMPDIR, process.argv[2]);

try { fs.mkdirSync(target); }
catch (e) {}

var origin = 'git@github.com:anodejs/anodejs-log.git';

console.log('Syncing all branches from ' + origin + ' to ' + target + '...');
gitsync.bsync(origin, target, ["feature1", "feature2"], "BRANCH_");

