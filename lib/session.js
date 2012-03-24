/**
 *
 * @revision    $Id: session.js 2012-03-24 17:23:07 Aleksey $
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

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

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

mongoose.model("Session", Session);


