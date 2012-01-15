var fs = require('fs');
var path = require('path');
var async = require('async');
var git = require('./git');

/**
 * A git library  
 */
function GitSync() {
};

/**
 * Checks if a directory contains a valid repository
 * @param repoDir The directory of the repository
 * @param callback (err, isValid)
 */
GitSync.prototype.isValid = function(repoDir, callback) {
    git(repoDir, ['log', '-1'], function(err, stdout, stderr) {
        if (err) callback(err, false);
        else callback(null, true);
    });
};

/**
 * Resets, recovers and pulls from a git repository.
 * @param repoDir The direcroty where the repository is at.
 * @param branch The branch to fetch from.
 */
GitSync.prototype.align = function(repoDir, branch, callback) {
    var self = this;

    if (!repoDir) throw new Error('repoDir is required');
    if (!callback) callback = _defaultCallback;

    repoDir = path.resolve(repoDir);
    
    // Execute pulling steps in order.
    async.series([
        // Remove git lock file to recover if git operation was aborted during previous run.
        function(cb) {
            var lockFile = path.join(repoDir, '.git', 'index.lock');
            path.exists(lockFile, function(exists) {
                if (exists) {
                    fs.unlink(lockFile, function(err) {
                        if (err) {
                            log.warn('removing file ' + lockFile + ' failed with:', err);
                        }
                        else {
                            log.info('removed lock file: ' + lockFile);
                        }
                        cb(err, {removelock: 'remove git lock ' + lockFile + ', result ' + err});
                    });
                    return;
                }
                log.log('There is no lock file left, which is a good thing');
                cb(null, {removelock: 'no lock was present'});
            });
        },
        // Reset.
        function(cb) {
            log.log('git reset --hard ' + repoDir);
            git(repoDir, ['reset', '--hard'], function(err, stdout, stderr) {
                if (err) {
                    log.warn('Unable to reset at ' + repoDir + ":", err.msg);
                }
                cb(null, {reset: {stdout: stdout, stderr: stderr}});
            });
        },
        // Recover deleted files
        function(cb) {
            log.log('git checkout -- . ' + repoDir);
            git(repoDir, ['checkout', '--', '.'], function(err, stdout, stderr) {
                if (err) {
                    log.warn('Unable to recover files at ' + repoDir + ":", err.msg);
                }
                cb(null, {checkout: {stdout: stdout, stderr: stderr}});
            });
        },
        // Clean untracked files and directories.
        function(cb) {
            log.log('git clean -d -f ' + repoDir);
            git(repoDir, ['clean', '-d', '-f'], function(err, stdout, stderr) {
                if (err) {
                    log.warn('Unable to clean untracked at ' + repoDir + ":", err.msg);
                }
                cb(null, {clean: {stdout: stdout, stderr: stderr}});
            });
        },
        // Prune non-existing remote tracking branches
        function(cb) {
            log.log('git remote prune origin ' + repoDir);
            self.pruneOrigin(repoDir, function(err, stdout, stderr) {
                if (err) {
                    log.warn(err.msg + ":", err.err.msg);
                }
                cb(null, {prune: {stdout: stdout, stderr: stderr}});
            });
        },
        // Fetch to update the latest remote state of the repo.
        function(cb) {
            log.log('git fetch origin ' + repoDir);
            git(repoDir, ['fetch', 'origin'], function(err, stdout, stderr) {
                if (err) {
                    log.error('Unable to fetch at ' + repoDir + ':', err.msg);
                }
                cb(null, {fetch: {stdout: stdout, stderr: stderr}})
            });
        },
        // Pull.
        function(cb) {
            log.log('git pull origin ' + branch + ' ' + repoDir);
            git(repoDir, ['pull', 'origin', branch], function(err, stdout, stderr) {
                if (err) {
                    log.error('Unable to pull at ' + repoDir + ':', err.msg);
                }
                cb(err, {pull: {stdout: stdout, stderr: stderr}})
            });
        },
        // Compress.
        function(cb) {
            log.log('git gc --auto' + repoDir);
            git(repoDir, ['gc', '--auto'], function(err, stdout, stderr) {
                if (err) {
                    log.error('Unable to collect garbage at ' + repoDir + ':', err.msg);
                }
                cb(err, {gc: {stdout: stdout, stderr: stderr}})
            });
        }
    ],
    function(err, results) {
        // never fail
        callback(null, {dir: repoDir, err: err, results: results});
    });
};

/**
 * Clones a GIT repository. If the repository already exists, will pull the recent changes.
 * It does not validate that the existing repository actually matches the origin/branch definition.
 * @param url The URL of the repository to fetch from
 * @param branch The branch to fetch from (null == master)
 * @param dir The target directory
 * @param callback Callback to invoke when done
 */
GitSync.prototype.sync = function(url, branch, dir, callback) {
    var self = this;
    
    if (!url) throw new Error('url is required');
    if (!dir) throw new Error('dir is required');
    if (!branch) branch = 'master';
    if (!callback) callback = _defaultCallback;

    dir = path.resolve(dir);

    // check if we already have a directory by that name
    // if we do, assume it is already cloned and just pull.
    path.exists(dir, function(exists) {

        if (exists) {

            // make sure it contains an valid repository
            log.log("Checking if " + dir + " contains a valid git repo");
            self.isValid(dir, function(err, valid) {
                if (valid) {
                    self.align(dir, branch, callback);
                    return;
                }

                callback({ msg: "A directory with an invalid repository found at " + dir });
            });

            return;
        }

        // make sure root directory exists
        var root = path.dirname(dir);
        path.exists(root, function(exists) {
            if (!exists) {
                callback("parent of dir must exists (" + root + ")");
                return;
            }

            // clone the mfkr
            log.log("Cloning branch " + branch + " from " + url + " into " + dir);
            git(root, ['clone', '-b', branch, url, dir], callback);
        });
    });
};

/*
 * Lists all the branches in a repository
 */
GitSync.prototype.branches = function(url, callback) {
    var self = this;
    if (!url) throw new Error('url is required');
    if (!callback) callback = _defaultCallback;

    //git ls-remote --heads /Users/eladb/Desktop/anodebranchtests/repo/
    git('.', ['ls-remote', '--heads', url], function(err, stdout, stderr) {
        if (err) {
            callback(err);
            return;
        }

        var branches = [];
        var lines = stdout.split(/\r\n|\r|\n/);
        lines.forEach(function(line) {
            if (!line) return; // skip empty lines
            var parts = line.split('\t');
            if (parts.length < 2) {
                log.warn('Skipping invalid line from ls-remote:', line);
                return;
            }

            var head = parts[1];
            head = head.replace('refs/heads/', '');
            
            branches.push(head);
        });

        callback(null, branches);
    });
}

/**
 * Synchronizes (clone/pull) a set of branches from a remote repository
 * into a target filesystem location.
 * @param origin The URL of the remote repository
 * @param target The target filesystem location
 * @param branches A list of branches to sync (if null, will sync all branches)
 * @param prefix Prefix for local directory names
 * @param callback Callback to invoke when done 
 */
GitSync.prototype.bsync = function(origin, target, branches, prefix, callback) {
      var self = this;
    
    if (!origin) throw new Error('origin is required');
    if (!target) throw new Error('target is required');
    if (!prefix) prefix = '';
    if (!callback) callback = _defaultCallback;

    if (!branches) {
      // funny, this calls bsync...
      self.bsyncAll(origin, target, prefix, callback);
      return;
    }

    // make sure root exists
    _ensureExists(target, function(err) {
        if (err) {
            callback({ msg: "unable to create directory " + target, err: err });
            return;
        }
        
        var results = {};
    
        var _cloneFn = function(branch) {
            return function(_callback) {
                var branchDir = path.join(target, prefix + branch);
                log.log('Syncing branch ' + branch + ' from ' + origin + ' to ' + prefix + branch);
                
                self.sync(origin, branch, branchDir, function(err, status) {
                    results[branch] = {
                        dir: branchDir,
                        status: status,
                    };
    
                    if (err) {
                        results[branch].err = err;
                    }
    
                    _callback(null);
                });
            };
        };
    
        // build clone/pull list
        var fns = [];
        branches.forEach(function(branch) {
            fns.push(_cloneFn(branch));
        });
    
        async.parallel(fns, function(err) {
            if (err) {
                callback(err);
                return;
            }
    
            callback(null, results);
        });
    });
}

/**
 * Synchronizes (clone/pull) all the branches from a remote repository
 * into a target filesystem location.
 * @param origin The URL of the remote repository
 * @param target The target filesystem location
 * @param prefix Prefix for local directory names
 * @param callback Callback to invoke when done 
 */
GitSync.prototype.bsyncAll = function(origin, target, prefix, callback) {
  var self = this;

  log.log('Listing branches for ' + origin);
  self.branches(origin, function (err, branches) {
    if (err) {
      callback(err);
      return;
    }

    self.bsync(origin, target, branches, prefix, callback);
  });
}

/**
 * Returns the current branch of a directory
 */
GitSync.prototype.currentBranch = function(dir, callback) {
    var self = this;
    if (!dir) throw new Error('dir is required');
    if (!callback) callback = _defaultCallback;
    
    dir = path.resolve(dir);
    
    git(dir, ['branch'], function(err, stdout, stderr) {
        if (err) {
            callback({msg:"unable to determine current branch", err: err, stdout: stdout, stderr: stderr });
            return;
        }
        
        var currentBranch = null;
        stdout.split('\n').forEach(function(line) {
            if (!line) return;
            if (line[0] === "*") {
                line = line.replace('*', '').replace(/\W/g, '');''
                currentBranch = line;
            }
        });
        
        if (!currentBranch) {
            callback({msg:"unable to determine current branch", stderr: stderr, stdout: stdout});
        }
        else {
            callback(null, currentBranch);
        }
    });
}

/**
 * Returns all the branches that are merged into the given branch (i.e. branches whose latest commit is contained in the given branch)
 * @param dir The direcroty where the repository is at.
 * @param branch The branch to check for.
 */
GitSync.prototype.mergedBranches = function(dir, branch, callback) {
    var self = this;
    if (!dir) throw new Error('dir is required');
    if (!branch) branch = 'master';
    if (!callback) callback = _defaultCallback;

    dir = path.resolve(dir);
    
    git(dir, ['branch', '-a', '--merged', branch], function(err, stdout, stderr) {
        if (err) {
            callback({msg:"unable to determine merged branches", err: err, stdout: stdout, stderr: stderr });
            return;
        }

        var mergedBranches = [];
        stdout.split('\n').forEach(function(line) {
            if (!line) return;

            // Remove all '*' and whitespaces before adding to the result
            mergedBranches.push(line.replace(/\*/g, '').replace(/^\s+|\s+$/g, ''));
        });

        callback(null, mergedBranches);
    });
}

/**
 * Returns remotes information for a directory
 * @param dir The git repo directory
 * @param callback {Function(err, remotes)} Callback
 */
GitSync.prototype.remotes = function(dir, callback) {
    var self = this;
    
    dir = path.resolve(dir);
    
    git(dir, ['remote', '-v'], function(err, stdout, stderr) {
        if (err) {
            callback({ msg: "unable to list remotes", err: err, stderr: stderr, stdout: stdout });
            return;
        }
        
        var remotes = {};
        
        stdout.split('\n').forEach(function(line) {
            if (!line) return; // skip empty lines
            var parts = line.split('\t');
            if (parts.length != 2) {
                console.warn('unable to parse:', line);
                return;
            }
            
            var name = parts[0];
            var url = parts[1];
            
            var per = url.indexOf('(');
            var method = url.substring(per).replace(/[\(\)]/g, '');
            url = url.substring(0, per - 1);
            
            if (!remotes[name]) remotes[name] = {};
            remotes[name][method] = url;
        });
        
        callback(null, remotes);
    });
}

/**
 * Git remote prune - delete all local branches not in the remote 'origin'
 * 
 */
GitSync.prototype.pruneOrigin = function(dir, callback) {
  var self = this;
  
  dir = path.resolve(dir);
  
  git(dir, ['remote','prune','origin'], function(err, stdout, stderr) {
    if (err) {
      callback({ msg: 'unable to prune against origin from ' + dir, err: err } , stdout, stderr);
      return;
    }
    
    callback(null, stdout, stderr);
  });
}

/**
 * Iterates through all the subdirectories of `baseDir` and prunes
 * all of them against origin.
 */
GitSync.prototype.pruneAll = function(baseDir, callback) {
  var self = this;
  
  fs.readdir(baseDir, function(err, files) {
    if (err) {
      callback({ msg: "unable to read directory" + baseDir, err: err });
      return;
    }
    
    var fns = [];

    files.forEach(function(fileName) {
      var filePath = path.resolve(path.join(baseDir, fileName));
      fns.push((function(_dir) { 
        return function(cb) {
          fs.stat(_dir, function(err, stat) {
            if (stat.isDirectory()) {
              self.pruneOrigin(_dir, cb);
            }
          });
        };
      })(filePath));
    });

    async.parallel(fns, callback);
  });
}

/**
 * Git log
 * @param dir Directory where to run
 * @param opts Options to pass to git log.
 * @param callback Callback to call with the result
 */
GitSync.prototype.log = function(dir, opts, callback) {
    var self = this;
    var args = [];
    args.push('log');

    if (opts) {
        for (var name in opts) {
            var value = opts[name];
            args.push('--' + name + '=' + value);
        }
    }

    dir = path.resolve(dir);
    var format = '%ce^^%cd^^%s';
    args.push('--format=' + format);
    args.push(dir);

    git(dir, args, function (err, stdout, stderr) {
        if (err) {
            callback(err);
            return;
        }

        var commits = [];
        stdout.split('\n').forEach(function (l) {
            if (!l) return;
            var l = l.split('^^');
            var commit = {
                committer: l[0],
                date: new Date(l[1]),
                subject: l[2],
            };

            commits.push(commit);
        });

        callback(null, commits);
    });
}

//
// Helpers
//

function _defaultCallback(err) {
    if (err) {
        log.error(err);
        return;
    }

    delete arguments['0'];
    var hasArgs = false;
    for (var k in arguments) {
        console.log(arguments[k]);
        hasArgs = true;
    }

    if (!hasArgs) console.log('Done.');
}

/**
 * Ensures that a directory exists. If it doesn't, creates it and it's parents if needed.
 */
function _ensureExists(dir, callback) {
    dir = path.resolve(dir); // make full path
    
    path.exists(dir, function(exists) {
        if (!exists) {
            // ensure that the parent dir exists
            _ensureExists(path.dirname(dir), function(err) {
                if (err) {
                    callback(err);
                    return;
                }
                
                // make the dir
                log.log('Creating ' + dir);
                fs.mkdir(dir, function(err) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    
                    callback(null);
                });
            });
        }
        else {
            callback(null);
        }
    });
}

function Logger(module) {
    this.module = module;
}

Logger.prototype._log = function(fn, _args) {
    var args = [];
    args.push(this.module + ' --');
    for (var k in _args) {
        args.push(_args[k]);
    }
    fn.apply(null, args);
};

Logger.prototype.info = function()  { this._log(console.info, arguments); };
Logger.prototype.warn = function()  { this._log(console.warn, arguments); };
Logger.prototype.error = function() { this._log(console.error, arguments); };
Logger.prototype.log = function()   { this._log(console.log, arguments); };

var log = new Logger('gitsync');

//
// Exports
//

module.exports = GitSync;