# gits - Yet another friendly git module for node.js with some goodies (and async)

[![Build Status](https://secure.travis-ci.org/anodejs/node-gits.png)](http://travis-ci.org/anodejs/node-gits)

Apart from simply exposing ```git(dir, args, callback)``` there are a couple of nice utilities.

## Installation

```bash
npm install gits
```

## Usage

```javascript
var gits = require('gits');
```

API:

 * ```gits.align(dir, callback)``` - runs git reset, recovery commands and git pull in a directory
 * ```gits.sync(origin, branch, dir, callback)``` - clones/pulls origin/branch into dir
 * ```gits.bsync(origin, target, branches, prefix, callback)``` - clones multiple branches (or all if branches is null) from origin into subdirectories under target dir. 'prefix' is prepended to subdirectory names
 * ```gits.bsyncAll(origin, target, prefix, callback)``` - clones all branches from origin into target
 * ```gits.currentBranch(dir, callback)``` - returns the current branch of a directory
 * ```gits.git(dir, argsArray, callback)``` - just runs git command line
 * ```gits.remotes(dir, callback)``` - returns a hash with the remotes in the repo
 * ```gits.log(dir, opts, callback)``` - lists all the commits under a directory
 * ```gits.prune(dir, callback)``` - runs "git remote prune origin" for a directory
 * ```gits.pruneAll(basrDir, callback)``` - runs "git remote prune origin" against all subdirectories of "baseDir"

## License

MIT
