# MongoDB Session Storage for [ExpressJS](http://expressjs.com/)

express-mongodb is a MongoDB session store for [ExpressJS](http://expressjs.com/) backed by [mongoosejs](http://mongoosejs.com/)

## Installation

    $ npm install -g express-mongodb

## Usage overview

```js
var express = require('express'),
mongoose = require('mongoose'),
MongooseStore = require('express-mongodb')(express),
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
```


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