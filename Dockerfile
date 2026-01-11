FROM node:20

RUN apt-get update && apt-get install -y cron && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN chmod +x /app/run_parser2.sh

RUN sed -i 's|node |/usr/local/bin/node |g' /app/run_parser2.sh

RUN echo '0 5 * * * . /app/env.sh && /app/run_parser2.sh >> /proc/1/fd/1 2>&1' | crontab -

CMD ["sh", "-c", "printenv | sed 's/^\\([^=]*\\)=\\(.*\\)$/export \\1=\"\\2\"/' > /app/env.sh && cron -f"]