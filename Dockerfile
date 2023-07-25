FROM nginx

RUN rm /etc/nginx/conf.d/default.conf

ADD default.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/
RUN chmod 775 -R /usr/share/nginx/html
EXPOSE 80/tcp