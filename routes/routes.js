var appRouter = function(app) {
    //requirements
    var forge = require("node-forge")
    var pki = forge.pki;
    var fs = require('fs');

    //process environment vars
    var DockerHostName = process.env.DockerHost || "DockerHost"
    var DockerHostIPs = process.env.DockerHostIPs || "127.0.0.1"
    var privatePassword = process.env.CAPassphrase || "cdscdockerswarm"    
    var CAPath = process.env.CAPath || 'C:\\DockerTLSCA'
    var CertPath = process.env.ALLUSERSPROFILE + '\\docker\\certs.d'
    var ClientCertPath  =  process.env.USERPROFILE + '\\.docker'
    
    //declare vars
    
    var CApem;
    var encPrivateKey;
    var CAprivateKey;
    
    //set paths
    var CAKey = CAPath + '\\ca-key.pem';
    var CACert = CAPath + '\\ca.pem';
    var ServerCert = CertPath + '\\cert.pem';
    var ServerKey = CertPath + '\\key.pem';
    var ServerCA = CertPath + '\\ca.pem';
    var ClientKey = ClientCertPath + '\\key.pem';
    var ClientCert = ClientCertPath + '\\cert.pem';
    

    //create CA cert for signing
    function CreateCACert (HostName, privatePassword, callback) {
        var keys = pki.rsa.generateKeyPair(2048);
        var cert = pki.createCertificate();
        cert.publicKey = keys.publicKey;

        cert.serialNumber =  parseInt(Math.random() * (100000 - 10) + 10)
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5);
        var attrs = [{
        name: 'commonName',
        value: HostName
        }, {
        name: 'countryName',
        value: 'Dockerstan'
        }, {
        shortName: 'ST',
        value: 'DockerLand'
        }, {
        name: 'localityName',
        value: 'DockerVille'
        }, {
        name: 'organizationName',
        value: 'Swarm'
        }, {
        shortName: 'OU',
        value: 'DSC'
        }];
        cert.setSubject(attrs);
        cert.setIssuer(attrs);
        cert.setExtensions([{
        name: 'basicConstraints',
        cA: true
        }, {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        keyEncipherment: true,
        dataEncipherment: true
        }, {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
        codeSigning: true,
        emailProtection: true,
        timeStamping: true
        }, {
        name: 'nsCertType',
        sslCA: true,
        }, {
        name: 'subjectKeyIdentifier'
        }]);
        // self-sign certificate
        cert.sign(keys.privateKey);        
        encPrivateKey = pki.encryptRsaPrivateKey(keys.privateKey, privatePassword);
        // convert a Forge certificate to PEM
        var pem = pki.certificateToPem(cert);
        fs.writeFileSync(CAKey, encPrivateKey)
        fs.writeFileSync(CACert, pem)
        return callback(null, {key: keys.privateKey,cert: pem })
    }

    //Get existing CA cert for use, or create one if does not exist
    function GetCAKey (callback) {
        if (!fs.existsSync(CAKey)) {
            console.log("Writing CA Cert")
            console.log('Saving CA Key and Certs as: ' + CAKey + ' and ' + CACert)

            CreateCACert(DockerHostName, privatePassword, function (err,data) {
                 if (err) {
                    console.log("ERROR" + err);
                }
                else {
                    console.log("Created CA Cert");
                    CApem = data.cert;
                    CAprivateKey = data.key;
                    callback(null, {cert: CApem, key: CAprivateKey})         
                }
            });            
        }
        else {
            console.log("CA Certificate Exists; importing")
            console.log('Using CA Key and Certs from: ' + CAKey + ' and ' + CACert)

            encPrivateKey = fs.readFileSync(CAKey, "utf8")                
            CAprivateKey = pki.decryptRsaPrivateKey(encPrivateKey, privatePassword);          
            CApem  = fs.readFileSync(CACert, "utf8");               
            console.log("Got CA Cert");
            callback(null, {cert: CApem, key: CAprivateKey}) 
                    
        }
        
    }
    
    //create server cert for node access
    function CreateServerCert (DockerHostName, ips ,callback) {
        
        var keys = pki.rsa.generateKeyPair(2048);
        var cert = pki.createCertificate();
        cert.publicKey = keys.publicKey;

        cert.serialNumber =  parseInt(Math.random() * (100000 - 10) + 10)
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5);
        var attrs = [{
        name: 'commonName',
        value: DockerHostName
        }, {
        name: 'countryName',
        value: 'Dockerstan'
        }, {
        shortName: 'ST',
        value: 'DockerLand'
        }, {
        name: 'localityName',
        value: 'DockerVille'
        }, {
        name: 'organizationName',
        value: 'Swarm'
        }, {
        shortName: 'OU',
        value: 'DSC'
        }];
        cert.setSubject(attrs);
        cert.setIssuer(attrs);
        cert.setExtensions([{
        name: 'basicConstraints',
        cA: true
        }, {
        name: 'keyUsage',
        keyCertSign: false,
        digitalSignature: true,
        }, {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true
        }, {
        name: 'nsCertType',
        sslCA: false,
        }, {
        name: 'subjectKeyIdentifier'
        }, {
        name: 'subjectAltName',
        altNames: ips
        }]);
        // self-sign certificate
        cert.sign(CAprivateKey);
        // convert a Forge certificate to PEM
        var serverPem = pki.certificateToPem(cert);
        var serverKey =  pki.privateKeyToPem(keys.privateKey)
        callback(null, {'key': serverKey, 'cert': serverPem, 'ca': CApem})
    }

    //Create Client Cert for cli access
    function CreateClientCert (DockerHostName, callback) {
        
        var keys = pki.rsa.generateKeyPair(2048);
        var cert = pki.createCertificate();
        cert.publicKey = keys.publicKey;

        cert.serialNumber =  parseInt(Math.random() * (100000 - 10) + 10)
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5);
        var attrs = [{
        name: 'commonName',
        value: DockerHostName
        }, {
        name: 'countryName',
        value: 'Dockerstan'
        }, {
        shortName: 'ST',
        value: 'DockerLand'
        }, {
        name: 'localityName',
        value: 'DockerVille'
        }, {
        name: 'organizationName',
        value: 'Swarm'
        }, {
        shortName: 'OU',
        value: 'DSC'
        }];
        cert.setSubject(attrs);
        cert.setIssuer(attrs);
        cert.setExtensions([{
        name: 'basicConstraints',
        cA: true
        }, {
        name: 'keyUsage',
        keyCertSign: false,
        digitalSignature: true,
        }, {
        name: 'extKeyUsage',
        serverAuth: false,
        clientAuth: true
        }, {
        name: 'nsCertType',
        sslCA: false,
        }, {
        name: 'subjectKeyIdentifier'
        }]);
        // self-sign certificate
        cert.sign(CAprivateKey);
        // convert a Forge certificate to PEM
        var clientPem = pki.certificateToPem(cert);
        var clientKey =  pki.privateKeyToPem(keys.privateKey)
        callback(null, {key: clientKey, cert: clientPem })
    }
    //App Startup
    //Get CA Key and Create certs for running Docker Host
    GetCAKey( function (err,data) {
            if (err) {
            console.log("ERROR");
        }
        else {              
            CAprivateKey = data.key;
            console.log("Got Private Key");            
            console.log('Checking for Host Cert')      
            if (!fs.existsSync(ServerCert)) {  
                //IPS  
                 var ips = [{type: 7, ip: '127.0.0.1'}]                 
                //Get Certificate
                CreateServerCert( DockerHostName, ips, function (err,data) {
                    if (err) {
                            console.log("ERROR");
                    }
                    else {                                    
                        console.log('Saving Host Cert as: ' + ServerCert)
                        fs.writeFileSync(ServerKey, data.key)
                        fs.writeFileSync(ServerCert, data.cert)                
                        fs.writeFileSync(ServerCA, CApem)
                    }
                });
            }
            else {
                console.log('Host Certificate Exists')              

            }  
            
           if (!fs.existsSync(ClientCert)) {    
                CreateClientCert( DockerHostName, function (err,data) {
                    if (err) {
                            console.log("ERROR");
                    }
                    else {                                    
                        console.log('Saving Client Cert as: ' + ServerCert)
                        fs.writeFileSync(ClientKey, data.key)
                        fs.writeFileSync(ClientCert, data.cert)                
                    }
                });
            }
            else {
                console.log('Client Certificate Exists')              

            }  
        }
    });
    

     app.post("/swarmnode", function(req, res) {
        var ips = [{type: 7, ip: '127.0.0.1'}]
        for (var i = 0, len = req.body.ips.length; i < len; i++) {
            var ip = {type: 7, ip: req.body.ips[i]};
            ips.push(ip);
        }
        var serverCert;
        var clientCert;
        console.log('Sending Host Cert to ' + req.body.servername)
        CreateServerCert( req.body.servername, ips, function (err,data) {
            if (err) {
                    console.log("ERROR");
            }
            else {                                                    
                serverCert = data               
            }
        }),
         CreateClientCert( req.body.servername, function (err,data) {
            if (err) {
                    console.log("ERROR");
            }
            else {                                                    
                clientCert = data               
            }
        });;
        return res.send({ServerKey: serverCert.key, ServerCert: serverCert.cert, CACert: serverCert.ca ,clientKey: clientCert.key, clientCert: clientCert.cert})
     });

    
}
 
module.exports = appRouter;

