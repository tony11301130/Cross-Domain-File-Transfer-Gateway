'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import fs from 'fs/promises';
import { constants } from 'fs';

const prisma = new PrismaClient();

export async function getTransferConfig() {
    const config = await prisma.transferConfig.findUnique({
        where: { id: 'global' },
    });

    if (!config) {
        return {
            enableTransfer: false,
            host: '',
            port: 22,
            username: '',
            password: '',
            targetDir: '/tmp'
        };
    }
    return config;
}

export async function getPublicKey() {
    try {
        const keyPath = '/app/storage/keys/id_rsa.pub';
        await fs.access(keyPath, constants.R_OK);
        const key = await fs.readFile(keyPath, 'utf-8');
        return key;
    } catch (e) {
        return "SSH Key not found. It should have been generated on startup.";
    }
}

// 1. Save Configuration Only
export async function saveConfiguration(prevState: any, formData: FormData) {
    const enableTransfer = formData.get('enableTransfer') === 'on';
    const host = formData.get('host') as string;
    const port = parseInt(formData.get('port') as string) || 22;
    const username = formData.get('username') as string;
    const targetDir = formData.get('targetDir') as string;

    await prisma.transferConfig.upsert({
        where: { id: 'global' },
        update: {
            enableTransfer,
            host,
            port,
            username,
            targetDir,
        },
        create: {
            id: 'global',
            enableTransfer,
            host,
            port,
            username,
            targetDir,
        },
    });

    revalidatePath('/admin/settings');
    return { success: true, message: 'Configuration updated successfully.' };
}

// 2. Deploy Key Only
export async function deployKey(prevState: any, formData: FormData) {
    const host = formData.get('host') as string;
    const port = parseInt(formData.get('port') as string) || 22;
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!host || !username || !password) {
        return { success: false, message: 'Host, Username, and Password are required for deployment.' };
    }

    try {
        const publicKey = await getPublicKey();
        if (publicKey.startsWith('SSH Key not found')) {
            throw new Error('Local public key not found.');
        }

        const { Client } = require('ssh2');
        const conn = new Client();

        await new Promise<void>((resolve, reject) => {
            conn.on('ready', () => {
                const cmd = `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo "${publicKey.trim()}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`;
                conn.exec(cmd, (err: any, stream: any) => {
                    if (err) {
                        conn.end();
                        return reject(err);
                    }
                    stream.on('close', (code: any, signal: any) => {
                        conn.end();
                        if (code === 0) resolve();
                        else reject(new Error(`Deployment command failed with code ${code}`));
                    }).on('data', () => { }).stderr.on('data', () => { });
                });
            }).on('error', (err: any) => {
                reject(err);
            }).connect({
                host,
                port,
                username,
                password,
                readyTimeout: 10000,
            });
        });

        return { success: true, message: 'SSH Key successfully deployed to remote server.' };
    } catch (error: any) {
        return { success: false, message: `Deployment Failed: ${error.message}` };
    }
}

export async function resetTransferConfig() {
    await prisma.transferConfig.upsert({
        where: { id: 'global' },
        update: {
            enableTransfer: false,
            host: '',
            port: 22,
            username: '',
            password: null,
            targetDir: ''
        },
        create: {
            id: 'global',
            enableTransfer: false,
            host: '',
            port: 22,
            username: '',
            targetDir: ''
        }
    });
    revalidatePath('/admin/settings');
    return { success: true, message: 'Configuration reset to defaults.' };
}

export async function testConnection(formData: FormData) {
    'use server';
    const host = formData.get('host') as string;
    const port = parseInt(formData.get('port') as string) || 22;
    const username = formData.get('username') as string;

    // Read Private Key
    let privateKey = '';
    try {
        privateKey = await fs.readFile('/app/storage/keys/id_rsa', 'utf-8');
    } catch (e) {
        return { success: false, message: 'Private Key not found on server.' };
    }

    try {
        // Dynamically require ssh2 to avoid webpack bundling the binary module
        const ssh2 = require('ssh2');
        const { Client } = ssh2;
        const conn = new Client();

        return new Promise((resolve) => {
            conn
                .on('ready', () => {
                    conn.end();
                    resolve({ success: true, message: 'Connection established successfully using SSH Key!' });
                })
                .on('error', (err: any) => {
                    resolve({ success: false, message: `Connection failed: ${err.message}` });
                })
                .connect({
                    host,
                    port,
                    username,
                    privateKey,
                    readyTimeout: 5000,
                });
        });
    } catch (error: any) {
        return { success: false, message: `Internal Error: ${error.message}` };
    }
}
