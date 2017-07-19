/**Pscripted. 2017
 * https://github.com/pscripted/cDSCDockerSwarmTLSEnrollment/ * 
 */
var express = require("express");
var bodyParser = require("body-parser");
var forge = require("node-forge")
var app = express();
 
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
 
var routes = require("./routes/routes.js")(app);
 

var server = app.listen(3000, function () {
    console.log("Listening on port %s...", server.address().port);
});