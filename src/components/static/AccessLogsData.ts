export interface LogEntry {
  id: number;
  clientIP: string;
  timestamp: string;
  method: string;
  url: string;
  protocol: string;
  statusCode: number;
  responseSize: number;
  referer: string;
  userAgent: string;
  duration: string;
}

const accessLogsData: LogEntry[] = [
  {
    id: 1,
    clientIP: '192.168.1.1',
    timestamp: '[15/Jun/2024:12:34:56 +0000]',
    method: 'GET',
    url: '/index.html',
    protocol: 'HTTP/1.1',
    statusCode: 200,
    responseSize: 512,
    referer: 'http://example.com/previous-page.html',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '35ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 1,
    clientIP: '192.168.1.1',
    timestamp: '[15/Jun/2024:12:34:56 +0000]',
    method: 'GET',
    url: '/index.html',
    protocol: 'HTTP/1.1',
    statusCode: 200,
    responseSize: 512,
    referer: 'http://example.com/previous-page.html',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '35ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 1,
    clientIP: '192.168.1.1',
    timestamp: '[15/Jun/2024:12:34:56 +0000]',
    method: 'GET',
    url: '/index.html',
    protocol: 'HTTP/1.1',
    statusCode: 200,
    responseSize: 512,
    referer: 'http://example.com/previous-page.html',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '35ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 1,
    clientIP: '192.168.1.1',
    timestamp: '[15/Jun/2024:12:34:56 +0000]',
    method: 'GET',
    url: '/index.html',
    protocol: 'HTTP/1.1',
    statusCode: 200,
    responseSize: 512,
    referer: 'http://example.com/previous-page.html',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '35ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 1,
    clientIP: '192.168.1.1',
    timestamp: '[15/Jun/2024:12:34:56 +0000]',
    method: 'GET',
    url: '/index.html',
    protocol: 'HTTP/1.1',
    statusCode: 200,
    responseSize: 512,
    referer: 'http://example.com/previous-page.html',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '35ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  },
  {
    id: 2,
    clientIP: '192.168.1.2',
    timestamp: '[15/Jun/2024:12:35:12 +0000]',
    method: 'POST',
    url: '/submit-form',
    protocol: 'HTTP/1.1',
    statusCode: 302,
    responseSize: 256,
    referer: 'http://example.com/form.html',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    duration: '45ms'
  }
];

export default accessLogsData;
