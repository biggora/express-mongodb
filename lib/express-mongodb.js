/**
 *
 * @revision    $Id: express-mongodb.js 2012-03-24 16:21:10 Aleksey $
 * @created     2012-03-24 16:21:10
 * @category    Express Helpers
 * @package     express-mongodb
 * @version     0.0.3
 * @copyright   Copyright (c) 2009-2012 - All rights reserved.
 * @license     MIT License
 * @author      Alexey Gordeyev IK <aleksej@gordejev.lv>
 * @link        http://www.gordejev.lv
 *
 */


var Mongoose = require('mongoose'),
Schema = Mongoose.Schema;

var Session = new Schema({
    sid : {
        type : String,
        required : true,
        unique : true
    },
    data : {},
    lastAccess : {
        type : Date,
        index : true
    },
    expires : {
        type : Date,
        index : true
    }
});

/**
 * Default options
 */

var defaultOptions = {
    connection: Mongoose.connection,
    collection: 'session',
    clear_interval: -1
};

module.exports = function (express) {

    var Store = express.session.Store;

    function MongooseStore(options, cb) {
        var self = this;
        var connection = options.connection || defaultOptions.connection;
        var collection = options.collection || defaultOptions.collection;
        var clear_interval = options.clear_interval || defaultOptions.clear_interval;
        options = options || {};
        Store.call(this, options);
        Mongoose.model(collection, Session);
        self.collection = connection.model(collection);

        self._getCollection = function(cb) {
            cb && cb(self.collection);
        };

        if (clear_interval > 0) {
            self.clear_interval = setInterval(function() {
                self.collection.remove({
                    expires: {
                        $lt: new Date()
                    }
                }, function(err){
                    if(err) { console.log('Clear sessions: ', err); }
                });
            }, clear_interval * 1000, self);
        }
    }

    MongooseStore.prototype = new Store();

    MongooseStore.prototype.get = function (sid, cb) {
        var self = this;
        self._getCollection(function(collection) {
            collection.findOne({
                sid:sid
            }, function (err, session) {

                try {
                    if (err) {
                        cb(err, null);
                    } else {
                        if (session) {
                            if (!session.expires || new Date < session.expires) {
                                cb(null, session.data);
                            } else {
                                self.destroy(sid, cb);
                            }
                        } else {
                            cb();
                        }
                    }
                } catch (err) {
                    cb(err);
                }
            });
        });
    };

    MongooseStore.prototype.set = function (sid, data, cb) {
        var self = this;
        self._getCollection(function(collection) {
            try{
                var lastAccess = new Date(),
                expires = lastAccess.setDate(lastAccess.getDate() + 1);

                if(typeof data.cookie != 'undefined') {
                    expires = data.cookie._expires;
                }
                if(typeof data.lastAccess != 'undefined') {
                    lastAccess = new Date(data.lastAccess);
                }

                collection.update({
                    sid:sid
                }, {
                    data:data,
                    lastAccess: lastAccess,
                    expires: expires
                }, {
                    upsert:true
                }, cb);

            } catch (err) {
                cb && cb(err);
            }
        });
    };

    MongooseStore.prototype.destroy = function (sid, cb) {
        var self = this;
        self._getCollection(function(collection) {
            collection.remove({
                sid:sid
            }, cb);
        });
    };

    MongooseStore.prototype.all = function(cb) {
        var self = this;
        self._getCollection(function(collection) {
            collection.find({},function(err, sessions) {
                if (err) {
                    cb && cb(err);
                } else {
                    cb && cb(null, sessions);
                }
            });
        });
    };

    MongooseStore.prototype.length = function(cb) {
        var self = this;
        self._getCollection(function(collection) {
            collection.count({}, function(err, count) {
                if (err) {
                    cb && cb(err);
                } else {
                    cb && cb(null, count);
                }
            });
        });
    };

    MongooseStore.prototype.clear = function(cb) {
        var self = this;
        self._getCollection(function(collection) {
            collection.drop(function() {
                cb && cb();
            });
        });
    };

    return MongooseStore;

};


