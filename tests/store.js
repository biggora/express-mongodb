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
Session = mongoose.model('Session'),
app = express.createServer(),
db = "mongodb://localhost:27017/test";


mongoose.connect(db);

app.use(express.cookieParser());
app.use(express.session({
    cookie: {
        maxAge: 31557600000
    },
    secret: "Wild Express-MongoDB",
    store: new MongooseStore()
}));

app.get('/', function(req, res){
    Session.find({}, function (err, sessions) {
        if (err) console.log(err);
        res.send(sessions);
    });
});

app.listen(3000);