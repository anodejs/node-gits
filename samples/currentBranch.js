var git = require('../main');

git.currentBranch('.', function(err, branch) {
    console.log('current branch is:', branch);
});
