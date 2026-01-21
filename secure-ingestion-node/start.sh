#!/bin/sh
set -e

echo "Starting deployment script..."

# Ensure database directory exists and is writable
mkdir -p /app/db /app/storage
chown -R nextjs:nodejs /app/db /app/storage
chmod -R 775 /app/db /app/storage

# Create DB file if missing
touch /app/db/dev.db
chown nextjs:nodejs /app/db/dev.db

# Ensure database schema is up to date
echo "Pushing DB schema..."
su-exec nextjs npx prisma db push

# Generate SSH Keys if missing
if [ ! -f /app/storage/keys/id_rsa ]; then
    echo "Generating SSH keys..."
    mkdir -p /app/storage/keys
    chown nextjs:nodejs /app/storage/keys
    su-exec nextjs ssh-keygen -t rsa -b 4096 -f /app/storage/keys/id_rsa -N ""
fi

# Seed database (create admin/user if missing)
echo "Seeding database..."
su-exec nextjs npx prisma db seed

# Start the CDR results worker in background
echo "Starting CDR Results Worker..."
su-exec nextjs node worker/index.js > /app/storage/worker.log 2>&1 &

# Start the application
echo "Starting Next.js Server..."
exec su-exec nextjs node server.js
