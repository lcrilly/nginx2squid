export default { connect }

function connect(s) {
    // When we receive the first bytes from the client, hold them while we
    // open a HTTP CONNECT tunnel with the forward proxy.
    s.on('upload', function(data, flags) {
        var host = '';
        var req = data; // Make a copy of the client request (we'll send it later)
        if (typeof(s.variables.ssl_preread_server_name) == "undefined") {
            // Obtain host from request header
            var headers = req.split("\r\n");
            for (var i = 0; i < headers.length; i++) {
                if (headers[i].search(/host:/i) >= 0) {
                    host = headers[i].split(' ')[1];
                }
            }
            ngx.log(ngx.WARN, `CONNECT (plaintext) host: ${host}`);
            s.send(`CONNECT ${host}:80 HTTP/1.1\r\nHost: ${host}\r\n\r\n`);
        } else {
            // Obtain host from SNI
            host = s.variables.ssl_preread_server_name;
            ngx.log(ngx.WARN, `CONNECT (TLS) host: ${host}`);
            s.send(`CONNECT ${host} HTTP/1.1\r\n\r\n`);
        }
        s.off('upload');

        // Check the forward proxy has opened the tunnel
        s.on('download', function(data, flags) {
            var successMsg = "HTTP/1.1 200 Connection established\r\n\r\n";
            if (!data.startsWith(successMsg)) {
                ngx.log(ngx.ERR, `TUNNEL FAIL ${data.substring(0, 12)} (base64 bytes): ${data.toBytes().toString('base64')}`);
                throw Error("Failed to open tunnel");
            }
            ngx.log(ngx.WARN, "TUNNEL open");

            // All of the s.send() invocations in this code may get combined
            // when they reach the TCP layer, therefore we may receive
            // additional bytes from the upstream server here (e.g. the start
            // of a TLS handshake). Make sure we send only the extra bytes
            // back to the client before we unregister this callback.
            if (data.length > successMsg.length) {
                ngx.log(ngx.INFO, `EXTRA BYTES b64: ${data.slice(successMsg.length).toBytes().toString('base64')}`);
                s.send(data.slice(successMsg.length), flags);
            }
            s.off('download');
        });

        // Now we can send the client request through the tunnel
        s.send(req);
    });
}
