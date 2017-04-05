FROM cloudron/base:0.10.0
MAINTAINER Johannes Zellner <johannes@nebulon.de>

ENV PATH /usr/local/node-6.9.5/bin:$PATH

RUN apt-get update -y
RUN apt-get remove -y nginx-full && apt-get autoremove -y
RUN apt-get install -y transmission-daemon libldap2-dev libpcre3-dev

RUN mkdir -p /app/code

RUN mkdir -p /tmp/nginx-ldap
WORKDIR /tmp/nginx-ldap
RUN wget "https://github.com/kvspb/nginx-auth-ldap/archive/master.tar.gz" -O - \
    | tar -xz -C /tmp/nginx-ldap --strip-components=1

RUN mkdir -p /tmp/nginx
WORKDIR /tmp/nginx
RUN wget "https://nginx.org/download/nginx-1.11.12.tar.gz" -O - \
    | tar -xz -C /tmp/nginx --strip-components=1
RUN ./configure \
    --add-dynamic-module=/tmp/nginx-ldap \
    --modules-path=/usr/local/nginx/modules \
    --conf-path=/run/nginx.conf \
    --pid-path=/run/nginx.pid \
    --error-log-path=/run/nginx.error.log \
    --build=cloudron-river
RUN make install

WORKDIR /app/code

ADD package.json server.js /app/code/
RUN npm install --production

ADD src /app/code/src
ADD app /app/code/app
ADD cli /app/code/cli

RUN rm -rf /tmp/nginx-ldap /tmp/nginx

ADD start.sh README.md /app/code/

ADD transmission/settings.json /app/code/transmission.settings.json
ADD nginx/writeNginxConfig.js /app/code

## Supervisor
ADD supervisor/ /etc/supervisor/conf.d/
RUN sed -e 's,^logfile=.*$,logfile=/run/supervisord.log,' -i /etc/supervisor/supervisord.conf

## this is for debug only
# ADD .users.json /app/code

EXPOSE 8000

CMD [ "/app/code/start.sh" ]
