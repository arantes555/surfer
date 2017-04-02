FROM cloudron/base:0.10.0
MAINTAINER Johannes Zellner <johannes@nebulon.de>

ENV PATH /usr/local/node-6.9.5/bin:$PATH

RUN apt-get update -y
RUN apt-get install -y transmission-daemon

RUN mkdir -p /app/code
WORKDIR /app/code

ADD src /app/code/src
ADD app /app/code/app
ADD cli /app/code/cli

ADD package.json server.js /app/code/
RUN npm install --production
ADD start.sh README.md /app/code/

ADD transmission/settings.json /etc/transmission-daemon/settings.json.default
ADD nginx/nginx.conf /etc/nginx/nginx.conf

## Supervisor
ADD supervisor/ /etc/supervisor/conf.d/
RUN sed -e 's,^logfile=.*$,logfile=/run/supervisord.log,' -i /etc/supervisor/supervisord.conf

EXPOSE 8000

CMD [ "/app/code/start.sh" ]
