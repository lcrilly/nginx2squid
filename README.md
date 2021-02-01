proxy2squid
===========

This PoC demonstrates NGINX operating as a reverse proxy, where the backend is accessed through a forward proxy ([Squid](http://squid-cache.org)).

```
[Client]---(https)--->[NGINX]---(L4 tunnel)--->[Squid]---(https)--->[Backend]
```

The NGINX configuration uses the http module to present a virtual server to the Client, and the stream module to establish the forward proxy tunnel.

```
Client ==> [nginx_http --(unix socket)--> nginx_stream+njs] ==> Squid ==>[Backend]
```

NGINX is listening on proxy.example.com
Clients specify their desired backend by using the `X-Forward-To` request header. By default, only nginx.org and nginx.com are valid targets.

Example Request
---------------

```shell
$ curl -H "X-Forward-To: nginx.org" https://proxy.example.com/2009.html
```

1. NGINX (http module) terminates the request
2. The URI matches the `/` location (will be proxied with TLS)
3. The `X-Forward-To` request header is in the backend target allowlist (is not rejected)
4. The request is proxied to a local UNIX socket using TLS with `nginx.org` as the SNI server name
5. NGINX (stream module) obtains SNI data without terminating the request
6. The JavaScript module sends a `CONNECT` request to Squid (using SNI server name as the target), and waits for acknowledgement that the proxy tunnel is open.
7. The original request is proxied over the tunnel.

Demo
----

```shell
$ docker-compose up
```
1. Starts Squid (localhost:3128)
2. Starts NGINX (localhost:443)

```shell
$ curl -ik -H "X-Forward-To: nginx.org" https://localhost/2009.html
$ curl -ik -H "X-Forward-To: www.nginx.com" https://localhost/company/
```

Limitations
-----------

* Currently there is no way to specify the port that we should `CONNECT` *to* at the backend. The default 80/443 is used for plaintext/TLS, respectively. For plaintext traffic, this could be part of the `map` lookup based on target hostname.

* One request per tunnel, as per [RFC 7231](https://tools.ietf.org/html/rfc7231#section-4.3.6).

* Connections to the Squid proxy are unauthenticated. `Proxy-Authentication` header can be added to the JavaScript `connect()` funtion.
