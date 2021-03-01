export default { connect }

function connect(s) {
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
            s.log("CONNECT (plaintext) host: " + host);
            s.send("CONNECT " + host + ":80 HTTP/1.1\r\nHost: " + host + "\r\n\r\n");
        } else {
            // Obtain host from SNI
            host = s.variables.ssl_preread_server_name;
            s.log("CONNECT (TLS) host: " + host);
            s.send("CONNECT " + host + " HTTP/1.1\r\n\r\n");
        }
        s.off('upload');

        // Check the forward proxy has opened the tunnel
        s.on('download', function(data, flags) {
            if (data == 'HTTP/1.1 200 Connection established\r\n\r\n') {
                s.warn("TUNNEL open");
            } else {
                s.log("TUNNEL FAIL " + data.substring(0, 12) + " (base64 bytes): " + data.toBytes().toString('base64'));
                s.decline();
            }
            s.off('download');
        });

        // Now we can send the client request through the tunnel
        s.send(req);
    });
}
