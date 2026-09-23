module.exports = {
  apps: [
    {
      name: 'royal-backend',
      script: './Royal_inventory/src/server.js',
      cwd: './Royal_inventory',
      env: {
        NODE_ENV: 'production',
        PORT: 7575,
      },
      watch: false,
      max_memory_restart: '1G',
      autorestart: true,
    },
    {
      name: 'royal-frontend',
      script: './node_modules/vite/bin/vite.js',
      args: 'preview --host 0.0.0.0 --port 5173',
      cwd: './',
      env: {
        NODE_ENV: 'production',
      },
      watch: false,
      autorestart: true,
    },
  ],
};
