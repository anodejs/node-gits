# gits - Yet another friendly git module for node.js with some goodies (and async)

Apart from simply exposing ```git(dir, args, callback)``` there are a couple of nice utilities.

## Installation

```bash
npm install gitsync
```

## Usage

```javascript
var gits = require('gits');
```

API:

 * ```gits.pull(dir, callback)``` - runs git reset + git pull in a directory
 * ```gits.sync(origin, branch, dir, callbacl)``` - clones/pulls origin/branch into dir
 * ```gits.bsync(origin, target, branches, prefix, callback)``` - clones multiple branches (or all if branches is null) from origin into subdirectories under target dir. 'prefix' is prepended to subdirectory names
 * ```gits.bsyncAll(origin, target, prefix, callback)``` - clones all branches from origin into target
 * ```gits.currentBranch(dir, callback)``` - returns the current branch of a directory
 * ```gits.git(dir, argsArray, callback)``` - just runs git command line
 * ```gits.remotes(dir, callback)``` - returns a hash with the remotes in the repo

## License

MIT
