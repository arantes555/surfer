#!/usr/bin/env bash
'use strict'

const fs = require('fs')
const {LDAP_URL, LDAP_USERS_BASE_DN, LDAP_BIND_DN, LDAP_BIND_PASSWORD, LDAP_GROUPS_BASE_DN} = process.env

let authConfig, transmissionAuthConfig
if (LDAP_URL && LDAP_USERS_BASE_DN) {
  console.log('Using LDAP auth.')
  authConfig = `ldap_server cloudron {
        url ${LDAP_URL}/${LDAP_USERS_BASE_DN}?username;
        binddn ${LDAP_BIND_DN};
        binddn_passwd ${LDAP_BIND_PASSWORD};
        group_attribute ${LDAP_GROUPS_BASE_DN};
        group_attribute_is_dn on;
        require valid_user;
    }`
  transmissionAuthConfig = `auth_ldap "Forbidden";
            auth_ldap_servers cloudron;
`
} else {
  console.log('Using basic auth.')
  let users
  try {
    try {
      users = JSON.parse(fs.readFileSync('/app/data/.users.json', 'utf8'))
    } catch (e) {
      users = JSON.parse(fs.readFileSync('/app/code/.users.json', 'utf8'))
    }
  } catch (e) {
    console.warn('No .user.json file found. Using default admin:admin.')
    users = {admin: 'admin'}
  }
  const nginxAuth = Object.keys(users)
    .map(user => `${user}:{PLAIN}${users[user]}\n`)
    .join('')
  fs.writeFileSync('/run/nginx.auth', nginxAuth)
  authConfig = ''
  transmissionAuthConfig = `auth_basic "Forbidden";
            auth_basic_user_file "/run/nginx.auth";
`
}

const nginxConf = `user cloudron;
load_module "/usr/local/nginx/modules/ngx_http_auth_ldap_module.so";
worker_processes 1;
pid /run/nginx.pid;
daemon  off;

# Send logs to stderr
error_log /dev/stderr warn;

events {
    worker_connections 768;
}

http {
    ${authConfig}
    error_log /dev/stderr warn;
    log_format simple '$remote_addr [$time_local] "$request" $status $body_bytes_sent "$http_referer"';
    access_log /dev/stdout simple;

    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    client_body_temp_path /tmp/client_body 1 2;
    client_body_buffer_size 256k;
    client_body_in_file_only off;
    client_max_body_size 200M;

    proxy_temp_path /tmp/proxy_temp 1 2;
    fastcgi_temp_path /tmp/fastcgi_temp 1 2;
    uwsgi_temp_path  /tmp/uwsgi_temp 1 2;
    scgi_temp_path  /tmp/scgi_temp 1 2;

    server {
        error_log /dev/stderr warn;
        listen 8000 default_server;

        server_name _;

        location /transmission/ {
            ${transmissionAuthConfig}
            proxy_pass http://localhost:9091;
        }

        location / {
            proxy_pass http://localhost:3000;
        }
    }
}
`

fs.writeFileSync('/run/nginx.conf', nginxConf)
