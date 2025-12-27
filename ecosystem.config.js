module.exports = {
  apps: [
    {
      name: 'code-next',
      cwd: '/home/user/code/.next/standalone',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 7001,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'code-gateway',
      cwd: '/home/user/code',
      script: 'gateway.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      env: {
        NODE_ENV: 'production',
        PORT: 7002,
        NEXT_PORT: 7001,
        NEXT_HOST: '127.0.0.1',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};
