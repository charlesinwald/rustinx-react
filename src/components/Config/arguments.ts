type NginxBuildOption = string | { [key: string]: string };

export const NGINX_BUILD_OPTIONS: { [key: string]: NginxBuildOption } = {
  '--with-cc-opt': {
    '-g': 'Generates debug information for debugging tools.',
    '-O2': 'Optimizes the code for speed while keeping a balance between performance and compilation time.',
    '-ffile-prefix-map=/build/nginx-zctdR4/nginx-1.18.0=.': 'Maps file prefixes for debugging and reproducible builds.',
    '-flto=auto': 'Enables Link-Time Optimization (LTO), which improves performance by optimizing across translation units.',
    '-ffat-lto-objects': 'Generates LTO object files to be used in both LTO and non-LTO linking.',
    '-fstack-protector-strong': 'Adds stack protection to prevent stack overflow vulnerabilities.',
    '-Wformat': 'Enables warnings for format string vulnerabilities.',
    '-Werror=format-security': 'Treats format string warnings as errors, enhancing security.',
    '-fPIC': 'Generates position-independent code (PIC) required for shared libraries.',
    '-Wdate-time': 'Generates warnings for the usage of __DATE__ and __TIME__ macros.',
    '-D_FORTIFY_SOURCE=2': 'Provides additional compile-time and run-time checks for buffer overflows.',
  },
  '--with-ld-opt': {
    '-Wl,-Bsymbolic-functions': 'Binds references to global functions to the definition within the shared library.',
    '-flto=auto': 'Enables Link-Time Optimization (LTO) during the linking process.',
    '-ffat-lto-objects': 'Generates LTO object files to be used in both LTO and non-LTO linking.',
    '-Wl,-z,relro': 'Enables read-only relocations, enhancing security.',
    '-Wl,-z,now': 'Enforces immediate binding of all symbols during program startup, improving security.',
    '-fPIC': 'Generates position-independent code (PIC) required for shared libraries.',
  },
  '--prefix': 'Specifies the installation prefix.',
  '--conf-path': 'Specifies the path to the main NGINX configuration file.',
  '--http-log-path': 'Defines the path to the access log file.',
  '--error-log-path': 'Defines the path to the error log file.',
  '--lock-path': 'Specifies the path to the lock file.',
  '--pid-path': 'Specifies the path to the PID file.',
  '--modules-path': 'Sets the directory where modules will be installed.',
  '--http-client-body-temp-path': 'Specifies paths for temporary files used by different modules.',
  '--http-fastcgi-temp-path': 'Specifies the path for FastCGI temporary files.',
  '--http-proxy-temp-path': 'Specifies the path for proxy temporary files.',
  '--http-scgi-temp-path': 'Specifies the path for SCGI temporary files.',
  '--http-uwsgi-temp-path': 'Specifies the path for uWSGI temporary files.',
  '--with-compat': 'Enables compatibility with older versions of NGINX modules.',
  '--with-debug': 'Enables debugging support, useful for development and troubleshooting.',
  '--with-pcre-jit': 'Enables Just-In-Time compilation for Perl Compatible Regular Expressions (PCRE), improving performance.',
  '--with-http_ssl_module': 'Enables SSL/TLS support in NGINX, allowing encrypted connections.',
  '--with-http_stub_status_module': 'Provides a simple web page that displays NGINX status information.',
  '--with-http_realip_module': 'Allows changing the client address to the address sent in the request header.',
  '--with-http_auth_request_module': 'Enables the use of subrequests for user authentication.',
  '--with-http_v2_module': 'Enables support for HTTP/2 protocol, improving performance for web clients.',
  '--with-http_dav_module': 'Enables WebDAV support, allowing for file manipulation over HTTP.',
  '--with-http_slice_module': 'Enables response slicing, useful for serving large files more efficiently.',
  '--with-threads': 'Enables thread support, allowing for multi-threaded request processing.',
  '--add-dynamic-module': 'Adds a dynamic module to NGINX.',
  '--with-http_addition_module': 'Enables support for adding text before or after responses.',
  '--with-http_gunzip_module': 'Enables decompression of gzip-compressed responses.',
  '--with-http_gzip_static_module': 'Enables serving pre-compressed files with gzip.',
  '--with-http_sub_module': 'Enables support for replacing text in responses using regular expressions.',
};