// PM2 Ecosystem Config - InfraCheck BR
// Garante que NODE_ENV e as variaveis de ambiente estejam sempre corretas

module.exports = {
  apps: [
    {
      name: 'infracheck',
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
      error_file: '/home/ubuntu/.pm2/logs/infracheck-error.log',
      out_file: '/home/ubuntu/.pm2/logs/infracheck-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // Nao monitora mudancas de arquivo (modo producao)
      watch: false,
    },
  ],
};
