var testCase = require('nodeunit').testCase;
var GitSync = require('../lib/gitsync');
var path = require('path');
var fs = require('fs');

module.exports = testCase({
    setUp: function (cb) {
        this.gitsync = new GitSync();
        this.origin = path.resolve(__dirname, 'testgitrepo');
        this.target = path.join(process.env.TMP || process.env.TMPDIR, Math.round(Math.random() * 100000).toString());
        cb();
    },

    branches: function (test) {
        var self = this;
        self.gitsync.branches(self.origin, function (err, branches) {
            test.ok(!err, err && err.msg);
            test.ok(branches);
            test.deepEqual(branches, ['B1', 'B8', 'MyBranch', 'master']);
            test.done();
        });
    },

    currentBranch: function (test) {
        var self = this;
        self.gitsync.sync(self.origin, 'MyBranch', this.target, function (err) {
            test.ok(!err, err);
            self.gitsync.currentBranch(self.target, function (err, branch) {
                test.equals(branch, "MyBranch");
                test.done();
            });
        });
    },

    mergedBranches: function (test) {
        var self = this;
        self.gitsync.sync(self.origin, 'MyBranch', this.target, function (err) {
            test.ok(!err, err);
            self.gitsync.mergedBranches(self.target, 'MyBranch', function (err, branches) {
                test.ok(!err, err);

                // The merged branches list must at least contain the branch itself
                var found = false;
                branches.forEach(function (branch) {
                    if (branch.toLowerCase() === 'MyBranch'.toLowerCase()) {
                        found = true;
                    }
                });
                test.ok(found, 'Failed to validate merged branches');
                test.done();
            });
        });
    },

    resync: function (test) {
        var self = this;
        self.gitsync.sync(self.origin, 'MyBranch', self.target, function (err) {
            test.ok(!err, err);
            // sync again.
            self.gitsync.sync(self.origin, 'MyBranch', self.target, function (err, results) {
                test.ok(!err, err);
                test.ok(!results.err, results.err);
                test.done();
            });
        });
    },

    syncBranchesClone: function (test) {
        var self = this;
        self.gitsync.bsyncAll(self.origin, this.target, "PREFIX_", function (err, results) {
            test.ok(!err, err && err.msg);
            test.ok(results);
            for (var b in results) test.ok(!b.err, b.err); // verify we don't have any errors
            test.done();
        });
    },

    remotes: function (test) {
        var self = this;
        self.gitsync.sync(self.origin, 'MyBranch', self.target, function (err) {
            test.ok(!err, err);
            self.gitsync.remotes(self.target, function (err, remotes) {
                test.ok(!err, err);
                test.ok(remotes);
                test.ok(remotes.origin);
                test.ok(remotes.origin.fetch);
                test.ok(remotes.origin.push);
                test.done();
            });
        });
    },

// Fails on travis
//    log: function (test) {
//        var self = this;
//        self.gitsync.sync(self.origin, 'MyBranch', self.target, function (err) {
//            self.gitsync.log(self.target, {}, function (err, commits) {
//                console.log(commits);
//                test.ok(!err, JSON.stringify(err));
//                test.equals(commits.length, 4);
//                test.done();
//            });
//        });
//    },

    pruneAll: function (test) {
        var self = this;
        self.gitsync.bsyncAll(self.origin, self.target, "PREFIX_", function (err, results) {
            self.gitsync.pruneAll(self.target, function (err) {
                test.ok(!err, err);
                test.done();
            });
        });
    }
});
