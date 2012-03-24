/**
 *
 * @revision    $Id: express-mongodb.js 2012-03-24 16:21:10 Aleksey $
 * @created     2012-03-24 16:21:10
 * @category    Express Helpers
 * @package     express-mongodb
 * @version     0.0.2
 * @copyright   Copyright (c) 2009-2012 - All rights reserved.
 * @license     MIT License
 * @author      Alexey Gordeyev IK <aleksej@gordejev.lv>
 * @link        http://www.gordejev.lv
 *
 */

require('./session');

var mongoose = require('mongoose'),
Session = mongoose.model('Session');

module.exports = function (express) {

    var Store = express.session.Store;

    function MongooseStore(options) {
        Store.call(this, options);
    }

    MongooseStore.prototype = new Store();

    MongooseStore.prototype.get = function (sid, cb) {
        var self = this;
        Session.findOne({
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
    };

    MongooseStore.prototype.set = function (sid, data, cb) {
        try{
            var lastAccess = new Date(),
            expires = lastAccess.setDate(lastAccess.getDate() + 1);

            if(typeof data.cookie != 'undefined') {
                expires = data.cookie._expires;
            }
            if(typeof data.lastAccess != 'undefined') {
                lastAccess = new Date(data.lastAccess);
            }

            Session.update({
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
    };

    MongooseStore.prototype.destroy = function (sid, cb) {
        Session.remove({
            sid:sid
        }, cb);
    };

    MongooseStore.prototype.all = function(cb) {
        Session.find({},function(err, sessions) {
            if (err) {
                cb && cb(err);
            } else {
                cb && cb(null, sessions);
            }
        });
    };

    MongooseStore.prototype.length = function(cb) {
        Session.count({}, function(err, count) {
            if (err) {
                cb && cb(err);
            } else {
                cb && cb(null, count);
            }
        });
    };

    MongooseStore.prototype.clear = function(cb) {
        Session.drop(function() {
            cb && cb();
        });
    };

    return MongooseStore;

};


