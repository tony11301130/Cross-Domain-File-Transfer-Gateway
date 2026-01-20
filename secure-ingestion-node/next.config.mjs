/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    experimental: {
        serverActions: {},
    },
    webpack: (config) => {
        config.externals.push({
            'ssh2': 'commonjs ssh2',
            'cpu-features': 'commonjs cpu-features',
        })
        return config
    },
};

export default nextConfig;
