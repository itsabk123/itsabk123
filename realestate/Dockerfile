# Shelter and Sense v3 — local run with Apache + PHP 8.3 (same setup as shared hosting).
FROM php:8.3-apache

# .htaccess support (the app's security rules rely on it) + compression/headers.
RUN a2enmod rewrite headers deflate \
 && sed -ri 's#AllowOverride None#AllowOverride All#g' /etc/apache2/apache2.conf \
 && echo 'ServerName localhost' > /etc/apache2/conf-available/servername.conf && a2enconf servername

COPY . /var/www/html/
RUN rm -rf /var/www/html/tests/*.sqlite /var/www/html/data/*.sqlite* \
 && mkdir -p /var/www/html/data/uploads \
 && chown -R www-data:www-data /var/www/html/data

# Database and uploads live in a named volume so they survive rebuilds.
VOLUME ["/var/www/html/data"]
EXPOSE 80
