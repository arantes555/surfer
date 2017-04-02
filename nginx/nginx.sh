#!/usr/bin/env bash
echo "user cloudron;
load_module \"/usr/local/nginx/modules/ngx_http_auth_ldap_module.so\";
worker_processes 1;
pid /run/nginx.pid;
daemon  off;

# Send logs to stderr
error_log /dev/stderr warn;

events {
    worker_connections 768;
}

http {
    ldap_server cloudron {
        url $LDAP_URL/$LDAP_USERS_BASE_DN?username;
        binddn $LDAP_BIND_DN;
        binddn_passwd $LDAP_BIND_PASSWORD;
        group_attribute $LDAP_GROUPS_BASE_DN;
        group_attribute_is_dn on;
        require valid_user;
    }
    error_log /dev/stderr warn;
    log_format simple '\$remote_addr [\$time_local] \"\$request\" \$status \$body_bytes_sent \"\$http_referer\"';
    access_log /dev/stdout simple;

    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    client_body_temp_path /tmp/client_body 1 2;
    client_body_buffer_size 256k;
    client_body_in_file_only off;

    proxy_temp_path /tmp/proxy_temp 1 2;
    fastcgi_temp_path /tmp/fastcgi_temp 1 2;
    uwsgi_temp_path  /tmp/uwsgi_temp 1 2;
    scgi_temp_path  /tmp/scgi_temp 1 2;

    server {
        error_log /dev/stderr warn;
        listen 8000 default_server;

        server_name _;

        location /transmission/ {
            auth_ldap \"Forbidden\";
            auth_ldap_servers cloudron;
            proxy_pass http://localhost:9091;
        }

        location / {
            proxy_pass http://localhost:3000;
        }
    }
}
"
