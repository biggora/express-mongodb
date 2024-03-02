[![Build Status](https://travis-ci.org/biggora/express-mongodb.png?branch=master)](https://travis-ci.org/biggora/express-mongodb)
# MongoDB Session Storage for [ExpressJS](http://expressjs.com/)

express-mongodb is a MongoDB session store for [ExpressJS](http://expressjs.com/) backed by [mongoosejs](http://mongoosejs.com/)

## Installation

Installation is done using the Node Package Manager (npm). If you don't have npm installed on your system you can download it from [npmjs.org](http://npmjs.org/)
To install express-mongodb:

    $ npm install -g express-mongodb

## Usage overview

```js
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
        maxAge: 60000 // 1 min as example
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
```

## Options
  * `collection` Mongoose collection to host sessions. 'sessions' by default.
  * `clear_interval` sec. to check expired sessions to remove on db

## In the Wild

The following projects use express-mongodb.

If you are using express-mongodb in a project, app, or module, get on the list below
by getting in touch or submitting a pull request with changes to the README.

### Recommend extensions

- [Bootstrap Fancy File Plugin](http://biggora.github.io/bootstrap-fancyfile/)
- [Bootstrap Ajax Typeahead Plugin](https://github.com/biggora/bootstrap-ajax-typeahead)
- [TrinteJS - Javascrpt MVC Framework for Node.JS](http://www.trintejs.com/)
- [CaminteJS - Cross-db ORM for NodeJS](http://www.camintejs.com/)
- [Middleware exposing user-agent for NodeJS](https://github.com/biggora/express-useragent)
- [2CO NodeJS adapter for 2checkout API payment gateway](https://github.com/biggora/2co)

## Author

Aleksej Gordejev (aleksej@gordejev.lv).


## License

(The MIT License)

Copyright (c) 2012 Aleksej Gordejev <aleksej@gordejev.lv>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


## Resources

- Visit the [author website](http://www.gordejev.lv).
- Follow [@biggora](https://twitter.com/#!/biggora) on Twitter for updates.
- Report issues on the [github issues](https://github.com/biggora/express-mongodb/issues) page.


[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/biggora/express-mongodb/trend.png)](https://bitdeli.com/free "Bitdeli Badge")

