const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:3001/api/:path*',
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://127.0.0.1:3001/socket.io/:path*',
      },
    ];
  },
};

export default nextConfig;
