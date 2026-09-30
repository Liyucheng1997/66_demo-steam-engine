"""本地预览服务器（禁用缓存，修改代码后刷新即生效）。

用法：python serve.py [端口，默认 8753]
"""
import http.server
import socketserver
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8753
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('', port), NoCacheHandler) as httpd:
        print(f'蒸汽机演示已启动：http://localhost:{port}')
        httpd.serve_forever()
