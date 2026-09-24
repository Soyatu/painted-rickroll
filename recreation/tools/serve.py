"""Serves the recreation and saves frames the page posts back (for contact sheets and video export).

    python tools/serve.py [port] [frames-dir]

GET  /...            static files from the recreation folder
POST /save/<name>    writes the request body to <frames-dir>/<name> (basename only)
Binds to 127.0.0.1 only.
"""
import http.server
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'frames'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        if not self.path.startswith('/save/'):
            self.send_error(404)
            return
        name = os.path.basename(self.path[len('/save/'):].split('?')[0])
        if not name or name.startswith('.'):
            self.send_error(400)
            return
        size = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(size)
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / name).write_bytes(data)
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    print(f'serving {ROOT} on http://127.0.0.1:{PORT}, saving frames to {OUT}', flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
