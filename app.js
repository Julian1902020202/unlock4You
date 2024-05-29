import createBareServer from '@tomphttp/bare-server-node';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import serveStatic from 'serve-static';
import * as custombare from './static/customBare.mjs';

const PORT = process.env.PORT || 3000;
const bareServer = createBareServer('/bare/', {
  logErrors: true,
  localAddress: undefined
});

const serve = serveStatic(join(
  dirname(fileURLToPath(import.meta.url)),
  'static/'
), {
  fallthrough: false,
  maxAge: 5 * 60 * 1000
});

const server = http.createServer();

server.on('request', (request, response) => {
  try {
    const { url } = request;
    console.log(`Incoming request URL: ${url}`); // Log the incoming URL

    // Check if the URL matches the pattern /url/google.com
    const match = url.match(/^\/url\/(.+)/);

    if (match) {
      const targetUrl = match[1];
      console.log(`Matched target URL: ${targetUrl}`); // Log the matched target URL

      // Redirect the request to the proxy server
      request.url = `/bare/v2/${encodeURIComponent(targetUrl)}`;
      console.log(`Redirected request URL: ${request.url}`); // Log the redirected URL
    }

    if (custombare.route(request, response)) {
      console.log('Request routed through custombare');
      return true;
    }

    if (bareServer.shouldRoute(request)) {
      console.log('Routing request through BareServer');
      bareServer.routeRequest(request, response);
    } else {
      console.log('Serving static content');
      serve(request, response, err => {
        if (err) {
          console.error(`Error serving static files: ${err.stack}`); // Log the error stack
          response.writeHead(err.statusCode || 500, null, {
            "Content-Type": "text/plain"
          });
          response.end(err.stack);
        }
      });
    }
  } catch (e) {
    console.error(`Server error: ${e.stack}`); // Log the server error
    response.writeHead(500, "Internal Server Error", {
      "Content-Type": "text/plain"
    });
    response.end(e.stack);
  }
});

server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    console.log('Upgrading request through BareServer');
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

server.listen(PORT);

if (process.env.UNSAFE_CONTINUE)
  process.on("uncaughtException", (err, origin) => {
    console.error(`Critical error (${origin}):`);
    console.error(err);
    console.error("UNSAFELY CONTINUING EXECUTION");
    console.error();
  });

console.log(`Server running at http://localhost:${PORT}/.`);
