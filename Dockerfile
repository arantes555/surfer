FROM cloudron/base:0.10.0
MAINTAINER Johannes Zellner <johannes@nebulon.de>

ENV PATH /usr/local/node-6.9.5/bin:$PATH

RUN apt-get update -y
RUN apt-get install -y transmission-daemon nginx

RUN mkdir -p /app/code
WORKDIR /app/code

ADD src /app/code/src
ADD app /app/code/app
ADD cli /app/code/cli

ADD package.json server.js start.sh README.md /app/code/

ADD transmission/settings.json /etc/transmission-daemon/settings.json.default
ADD nginx/default /etc/nginx/sites-enabled/default

RUN npm install --production

EXPOSE 3000

CMD [ "/app/code/start.sh" ]
