FROM docker.io/nginx
RUN rm -rf /usr/share/nginx/html/*
COPY dist /usr/share/nginx/html/
COPY default.conf /etc/nginx/conf.d/default.conf
RUN chmod 775 -R /usr/share/nginx/html
EXPOSE 80/tcp
