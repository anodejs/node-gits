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
 * Resets and pulls from a git repository.
 * @param repoDir The direcroty where the repository is at.
 */
GitSync.prototype.pull = function(repoDir, callback) {
	var self = this;

    if (!repoDir) throw new Error('repoDir is required');
    if (!callback) callback = _defaultCallback;
    
    var result = {
        dir: repoDir,
        reset: {},
        pull: {},
    };

    // reset
    log.log('git reset --hard ' + repoDir);
    git(repoDir, ['reset', '--hard'], function(err, stdout, stderr) {
        result.reset.stdout = stdout;
        result.reset.stderr = stderr;
        if (err) {
            result.reset.err = err;
            log.warn('Unable to reset at ' + repoDir + ":", err.msg);
        }
        
        // now pull
        log.log('git pull ' + repoDir);
        git(repoDir, ['pull'], function(err, stdout, stderr) {
            result.pull.stdout = stdout;
            result.pull.stderr = stderr;
            if (err) {
                result.pull.err = err;
                log.error('Unable to pull at ' + repoDir + ':', err.msg);
            }
            
            // never fail
            callback(null, result);
        });
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
                    self.pull(dir, callback);
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
        var lines = stdout.split('\n');
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
    
    git(dir, ['branch'], function(err, stdout, stderr) {
        if (err) {
            callback({msg:"unable to determine current branch", err: err, stdout: stdout, stderr: stderr });
            return;
        }
        
        var currentBrnch = null;
        stdout.split('\n').forEach(function(line) {
            if (!line) return;
            if (line[0] === "*") {
                line = line.replace('*', '').replace(/\W/g, '');''
                currentBranch = line;
            }
        });
        
        if (!currentBranch) {
            callback({msg:"unable to determine current branch", status:status, stderr: stderr, stdout: stdout});
        }
        else {
            callback(null, currentBranch);
        }
    });
}

/**
 * Returns remotes information for a directory
 * @param dir The git repo directory
 * @param callback {Function(err, remotes)} Callback
 */
GitSync.prototype.remotes = function(dir, callback) {
    var self = this;
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

    var format = '%ce^^%cd^^%s';
    args.push('--format=' + format);
    args.push(path.normalize(dir));

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