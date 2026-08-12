// PM2 Ecosystem Config - InfraCheck BR
// Garante que NODE_ENV e as variaveis de ambiente estejam sempre corretas

module.exports = {
  apps: [
    {
      name: 'infracheck-api',
      script: 'npm',
      args: 'start',
      cwd: '/home/ubuntu/InfraCheck',

      // Ambiente de producao
      env_production: {
        NODE_ENV: 'production',
        PORT: '3000',
      },

      // Configuracoes de restart
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,

      // Logs
      error_file: '/home/ubuntu/.pm2/logs/infracheck-api-error.log',
      out_file: '/home/ubuntu/.pm2/logs/infracheck-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // Nao monitora mudancas de arquivo (modo producao)
      watch: false,
    },

    {
      // Job automático de cobrança — roda todo dia às 07:00
      // Escalona automaticamente lojas com pendências sem ação manual
      name: 'infracheck-auto-collection',
      script: '/home/ubuntu/InfraCheck/autoCollectionJob.mjs',
      cwd: '/home/ubuntu/InfraCheck',
      cron_restart: '0 7 * * *',
      autorestart: false,
      watch: false,
      error_file: '/home/ubuntu/.pm2/logs/infracheck-auto-collection-error.log',
      out_file: '/home/ubuntu/.pm2/logs/infracheck-auto-collection-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
