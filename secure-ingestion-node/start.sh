#!/bin/sh
set -e

echo "Starting deployment script..."

# Ensure database schema is up to date
echo "Pushing DB schema..."
npx prisma db push

# Generate SSH Keys if missing
if [ ! -f /app/storage/keys/id_rsa ]; then
    echo "Generating SSH keys..."
    mkdir -p /app/storage/keys
    ssh-keygen -t rsa -b 4096 -f /app/storage/keys/id_rsa -N ""
fi

# Seed database (create admin/user if missing)
echo "Seeding database..."
npx prisma db seed

# Start the application
echo "Starting Next.js Server..."
exec node server.js
