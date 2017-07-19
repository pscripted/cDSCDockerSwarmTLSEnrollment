## cDSCDockerSwarmTLS

**This Container is meant to be invoked by the DSC Resource cDSCDockerSwarm/cDockerTLSAutoEnrollment**

### Invokation

```
docker build -t cdscdockerswarm-tls:latest .

if (!(Test-Path $env:SystemDrive\DockerTLSCA)) {
    mkdir $env:SystemDrive\DockerTLSCA             
}
if (!(Test-Path $env:USERPROFILE\.docker)) {
    mkdir $env:USERPROFILE\.docker
}
if (!(Test-Path $env:ALLUSERSPROFILE\docker\certs.d)) {
    Write-Verbose "Create Folder $("$env:ALLUSERSPROFILE\docker\certs.d")"
    mkdir $env:ALLUSERSPROFILE\docker\certs.d
} 
             
#Run TLS Enrollment Container

#This will create local certs for the CA and running host, and allow other nodes to get their own signed certs from the CA            
docker run --rm `
-p 3000:3000 `
-e DockerHost=$env:computername `
-e DockerHostIPs=127.0.0.1,192.168.254.135 `
-v "$env:SystemDrive\DockerTLSCA:C:\DockerTLSCA" `
-v "$env:ALLUSERSPROFILE\docker:$env:ALLUSERSPROFILE\docker" `
-v "$env:USERPROFILE\.docker:c:\users\containeradministrator\.docker" ` cdscdockerswarm-tls:latest
```            
### Local Output 
**$env:SystemDrive\DockerTLSCA**
CA Cert: cert.pem 
CA Private Key: key.pem (default passphrase of 'cdscdockerswarm')

**$env:ALLUSERSPROFILE\docker**
Docker daemon cert: cert.pem
Docker daemon key: key.pem
Docker daemon CA Public cert: ca.pem

**$env:USERPROFILE\.docker**
Docker client cert: cert.pem
Docker client key: key.pem

### Remote Output 
Invoke a certificate request with 
```
Invoke-RestMethod http://<containerhost>:3000/swarmnode -Method Post `
-Body (@{servername=$env:computername;ips=@("192.168.0.20")} | Convertto-JSON) -ContentType "application/JSON"
```
Response
```
ServerKey  : -----BEGIN RSA PRIVATE KEY-----
             
             -----END RSA PRIVATE KEY-----
             
ServerCert : -----BEGIN CERTIFICATE-----
             
             -----END CERTIFICATE-----
             
caCert     : -----BEGIN CERTIFICATE-----
             
             -----END CERTIFICATE-----
             
clientKey  : -----BEGIN RSA PRIVATE KEY-----
             
             -----END RSA PRIVATE KEY-----
             
clientCert : -----BEGIN CERTIFICATE-----
                          
             -----END CERTIFICATE-----            

```
### Processing Certificates
 
 Use Install-cDSCSwarmTLSCert from the cDSCDockerSwarm Module

 To install client/user certificates on other machines:
```
 Install-cDSCSwarmTLSCert <SwarmIP>
 ```