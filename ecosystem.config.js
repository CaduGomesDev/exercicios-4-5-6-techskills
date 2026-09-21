module.exports = {
  apps: [
    {
      name: 'api',
      script: 'dist/index.js',
      exec_mode: 'fork',
      instances: 1,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
    },
  ],
};
