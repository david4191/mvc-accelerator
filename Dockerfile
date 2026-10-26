FROM php:8.3-apache

RUN docker-php-ext-install pdo_mysql \
    && a2enmod rewrite headers \
    && printf '%s\n' '<Directory /var/www/html>' '    AllowOverride All' '</Directory>' \
        > /etc/apache2/conf-available/api.conf \
    && a2enconf api \
    && mkdir -p /var/www/storage/logs /var/www/storage/cache \
    && chown -R www-data:www-data /var/www/storage

COPY api/ /var/www/html/

CMD ["sh", "-c", "sed -i \"s/Listen 80/Listen ${PORT:-10000}/\" /etc/apache2/ports.conf && sed -i \"s/<VirtualHost \\*:80>/<VirtualHost *:${PORT:-10000}>/\" /etc/apache2/sites-available/000-default.conf && exec apache2-foreground"]