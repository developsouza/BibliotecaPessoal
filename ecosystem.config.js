// PM2 Ecosystem Config — BookLibrary
// Uso: pm2 start ecosystem.config.js

module.exports = {
    apps: [
        {
            name: "booklibrary-api",
            script: "server.js",
            cwd: "/var/www/booklibrary/backend",
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            watch: false,
            max_memory_restart: "512M",
            env: {
                NODE_ENV: "production",
                PORT: 3002,
            },
            error_file: "/var/log/pm2/booklibrary-error.log",
            out_file: "/var/log/pm2/booklibrary-out.log",
            log_date_format: "YYYY-MM-DD HH:mm:ss",
        },
    ],
};
