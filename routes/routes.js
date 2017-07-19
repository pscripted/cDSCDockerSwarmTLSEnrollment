var appRouter = function(app) {
    //requirements
    var forge = require("node-forge")
    var pki = forge.pki;
    var fs = require('fs');

    //process environment vars
    var dockerHostName = process.env.DockerHost || "DockerHost"
    var dockerHostIPs = JSON.parse(process.env.DockerHostIPs || "[]")
    var privatePassword = process.env.CAPassphrase || "cdscdockerswarm"    
    var caPath = process.env.CAPath || 'C:\\DockerTLSCA'
    var certPath = process.env.ALLUSERSPROFILE + '\\docker\\certs.d'
    var clientCertPath  =  process.env.USERPROFILE + '\\.docker'
    
    //declare vars
    
    var caPem;
    var caCert;
    var encPrivateKey;
    var caPrivateKey;
    
    //set paths
    var caKey = caPath + '\\ca-key.pem';
    var caPemPath = caPath + '\\ca.pem';
    var serverCert = certPath + '\\cert.pem';
    var serverKey = certPath + '\\key.pem';
    var serverCA = certPath + '\\ca.pem';
    var clientKey = clientCertPath + '\\key.pem';
    var clientCert = clientCertPath + '\\cert.pem';
    var clientCA = clientCertPath + '\\ca.pem';
    

    //create CA cert for signing
    function CreateCACert (HostName, privatePassword, callback) {
        var keys = pki.rsa.generateKeyPair(2048);
        caCert = pki.createCertificate();
        caCert.publicKey = keys.publicKey;

        caCert.serialNumber =  '032';
        caCert.validity.notBefore = new Date();
        caCert.validity.notAfter = new Date();
        caCert.validity.notAfter.setFullYear(caCert.validity.notBefore.getFullYear() + 5);
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
        caCert.setSubject(attrs);
        caCert.setIssuer(attrs);
        caCert.setExtensions([{
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
        caCert.sign(keys.privateKey);
        encPrivateKey = pki.encryptRsaPrivateKey(keys.privateKey, privatePassword);
        // convert a Forge certificate to PEM
        var pem = pki.certificateToPem(caCert);
        fs.writeFileSync(caKey, encPrivateKey)
        fs.writeFileSync(caPemPath, pem)
        return callback(null, {'key': keys.privateKey,'cert': pem  })
    }

    //Get existing CA cert for use, or create one if does not exist
    function GetCAKey (callback) {
        if (!fs.existsSync(caKey)) {
            console.log("Writing CA Cert")
            console.log('Saving CA Key and Certs as: ' + caKey + ' and ' + caPemPath)

            CreateCACert(dockerHostName, privatePassword, function (err,data) {
                 if (err) {
                    console.log("ERROR" + err);
                }
                else {
                    console.log("Created CA Cert");
                    caPem = data.cert;
                    caPrivateKey = data.key;
                    callback(null, {cert: caPem, key: caPrivateKey})         
                }
            });            
        }
        else {
            console.log("CA Certificate Exists; importing")
            console.log('Using CA Key and Certs from: ' + caKey + ' and ' + caPemPath)

            encPrivateKey = fs.readFileSync(caKey, "utf8")                
            caPrivateKey = pki.decryptRsaPrivateKey(encPrivateKey, privatePassword);          
            caPem  = fs.readFileSync(caPemPath, "utf8");  
            caCert =  pki.certificateFromPem(caPem);
            
            console.log("Got CA Cert");
            callback(null, {cert: caPem, key: caPrivateKey}) 
                    
        }
        
    }
    
    //create server cert for node access
    function CreateServerCert (dockerHostName, ips ,callback) {
        
        var keys = pki.rsa.generateKeyPair(2048);
        var cert = pki.createCertificate();
        cert.publicKey = keys.publicKey;
        var serial =  (new Date).getTime(); 
        console.log(serial);
        cert.serialNumber = '01' //parseInt(Math.random() * (100000 - 10) + 10)
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5);
        var attrs = [{
        name: 'commonName',
        value: dockerHostName
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
        cert.setIssuer(caCert.subject.attributes);
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
        cert.sign(caPrivateKey);
        // convert a Forge certificate to PEM
        var newServerPem = pki.certificateToPem(cert);
        var newServerKey =  pki.privateKeyToPem(keys.privateKey)
        callback(null, {'key': newServerKey, 'cert': newServerPem, 'ca': caPem})
    }

    //Create Client Cert for cli access
    function CreateClientCert (dockerHostName, callback) {
        
        var keys = pki.rsa.generateKeyPair(2048);
        var cert = pki.createCertificate();
        cert.publicKey = keys.publicKey;

        cert.serialNumber =  '02'
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5);
        var attrs = [{
        name: 'commonName',
        value: dockerHostName
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
        cert.setIssuer(caCert.subject.attributes);
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
        cert.sign(caPrivateKey);
        // convert a Forge certificate to PEM        
        var newClientPem = pki.certificateToPem(cert);
        var newClientKey =  pki.privateKeyToPem(keys.privateKey)
        callback(null, {key: newClientKey, cert: newClientPem })
    }
    //App Startup
    //Get CA Key and Create certs for running Docker Host
    GetCAKey( function (err,data) {
            if (err) {
            console.log("ERROR");
        }
        else {              
            caPrivateKey = data.key;
            console.log("Got Private Key");            
            console.log('Checking for Host Cert')      
            if (!fs.existsSync(serverCert)) {  
                //IPS  
                 var ips = []                 
                 for (var i = 0, len = dockerHostIPs.length; i < len; i++) {
                    var ip = {type: 7, ip: dockerHostIPs[i]};
                    ips.push(ip);
                 }                 
                //Get Certificate
                CreateServerCert( dockerHostName, ips, function (err,data) {
                    if (err) {
                            console.log("ERROR");
                    }
                    else {                                    
                        console.log('Saving Host Cert as: ' + serverCert)
                        fs.writeFileSync(serverKey, data.key)
                        fs.writeFileSync(serverCert, data.cert)                
                        fs.writeFileSync(serverCA, caPem)
                    }
                });
            }
            else {
                console.log('Host Certificate Exists')              

            }  
            
           if (!fs.existsSync(clientCert)) {    
                CreateClientCert( dockerHostName, function (err,data) {
                    if (err) {
                            console.log("ERROR");
                    }
                    else {                                    
                        console.log('Saving Client Cert as: ' + serverCert)
                        fs.writeFileSync(clientKey, data.key)
                        fs.writeFileSync(clientCert, data.cert)
                        fs.writeFileSync(clientCA, caPem)                
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
        var newServerCert;
        var newClientCert;
        console.log('Sending Host Cert to ' + req.body.servername)
        CreateServerCert( req.body.servername, ips, function (err,data) {
            if (err) {
                    console.log("ERROR");
            }
            else {                                                    
                newServerCert = data               
            }
        }),
         CreateClientCert( req.body.servername, function (err,data) {
            if (err) {
                    console.log("ERROR");
            }
            else {                                                    
                newClientCert = data               
            }
        });;
        return res.send({serverKey: newServerCert.key, ServerCert: newServerCert.cert, CACert: newServerCert.ca ,clientKey: newClientCert.key, clientCert: newClientCert.cert})
     });

    
}
 
module.exports = appRouter;

