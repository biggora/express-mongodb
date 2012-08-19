/**
 *
 * @revision    $Id: store.js 2012-03-24 18:14:00 Aleksey $
 * @created     2012-03-24 18:27:10
 * @category    Express Helpers
 * @package     express-mongodb
 * @version     0.0.2
 * @copyright   Copyright (c) 2009-2012 - All rights reserved.
 * @license     MIT License
 * @author      Alexey Gordeyev IK <aleksej@gordejev.lv>
 * @link        http://www.gordejev.lv
 *
 */

var express = require('express'),
mongoose = require('mongoose'),
MongooseStore = require("./../lib/express-mongodb")(express),
app = express.createServer(),
db = "mongodb://localhost:27017/test",
options = {
    collection: 'mysession',
    clear_interval: 60 // 1 min
};

mongoose.connect(db);

app.use(express.cookieParser());
app.use(express.session({
    cookie: {
        maxAge: 60000 // 1 min
    },
    secret: "Wild Express-MongoDB",
    store: new MongooseStore(options)
}));

app.get('/', function(req, res){
    var collection = mongoose.model(options.collection);
    collection.find({}, function (err, sessions) {
        if (err) console.log(err);
        res.send(sessions);
    });
});

app.listen(3000);